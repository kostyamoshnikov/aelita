#!/usr/bin/env python3
"""Build and verify a site-only preview using a verified AELITA pack."""

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
from urllib.request import Request, urlopen
from zipfile import ZipFile


REPO = "kostyamoshnikov/aelita"
SCHEMA = "aelita.site-candidate/v1"
PACK_VERSION = re.compile(r"pack-v[1-9][0-9]*")
COMMIT_ID = re.compile(r"[0-9a-f]{40}")
SHA256 = re.compile(r"[0-9a-f]{64}")


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args])


def tree(repo, ref):
    result = {}
    for record in git(repo, "ls-tree", "-rz", ref).split(b"\0"):
        if not record:
            continue
        header, raw_path = record.split(b"\t", 1)
        mode, kind, sha = header.decode("ascii").split()
        if kind == "blob" and mode in ("100644", "100755"):
            result[raw_path.decode("utf-8")] = sha
    return result


def file_sha256(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def public_path(value):
    if not isinstance(value, str) or not value or "\\" in value or any(ord(c) < 32 for c in value):
        raise ValueError(f"Invalid public path: {value!r}")
    if any(not item or item.startswith((".", "_")) for item in value.split("/")):
        raise ValueError(f"Invalid public path: {value!r}")
    if any(c in value for c in "?#:`"):
        raise ValueError(f"Invalid public path: {value!r}")
    return PurePosixPath(value)


def read_github(method, path, *, token=None):
    if method != "GET" or not path.startswith(f"/repos/{REPO}/"):
        raise ValueError("The preview only reads the AELITA repository")
    request = Request(f"https://api.github.com{path}", headers={
        "Accept": "application/vnd.github+json", "User-Agent": "AELITA-site-preflight"
    })
    with urlopen(request, timeout=25) as response:
        return json.load(response)


def prepare(args):
    tools = args.pack_root.resolve() / "_tools"
    with ZipFile(args.core) as archive:
        if archive.read("PACK_PARTS.json") != (args.pack_root / "PACK_PARTS.json").read_bytes():
            raise ValueError("The extracted pack does not match the supplied core archive")
    subprocess.run([sys.executable, str(tools / "Pack/verify_release_archives.py"),
                    "--core", str(args.core), "--deploy", str(args.deploy),
                    "--sha256sums", str(args.sums)], check=True)
    subprocess.run([sys.executable, str(tools / "Pack/parts.py"), "verify"], check=True)

    sys.path.insert(0, str(tools / "SiteDeploy"))
    import deploy_site as site

    base = git(args.repo, "rev-parse", "HEAD").decode().strip()
    head = read_github("GET", f"/repos/{REPO}/git/ref/heads/main")["object"]["sha"]
    if base != head:
        raise ValueError("Update the repository checkout to current main before preparing the preview")
    remote = tree(args.repo, base)
    site.site_changes.check_source(site.ROOT)
    local = site.local_files()

    def read_blob(path):
        return git(args.repo, "cat-file", "blob", remote[path])

    for key, module in (("nav", site.site_nav), ("home", site.site_home)):
        path = module.REL_PATH
        if path in remote and (path not in local or site.git_blob_sha(local[path].read_bytes()) != remote[path]):
            site.LIVE[key] = module.loads(read_blob(path).decode("utf-8"))

    prepared = site.site_changes.prepare(local, remote, read_blob, site.LIVE, site.SITE,
                                         {"nav": site.site_nav.loads, "home": site.site_home.loads})
    plan = site.classify(*site.diff(local, remote), writable=prepared["writes"])
    site.site_changes.include_deletions(plan, prepared, remote)
    site.api_retry = read_github
    foreign, complete = site.foreign_paths(None, REPO, "main")
    held = site.hold_foreign(plan, foreign)
    head = read_github("GET", f"/repos/{REPO}/git/ref/heads/main")["object"]["sha"]
    if head != base:
        raise ValueError("main changed during the comparison. Prepare the preview again")
    if complete and not held:
        site.site_changes.add_receipt(local, plan["upload"], plan["delete"],
                                     site.site_bytes, prepared, site.pack_version())

    args.output.mkdir(parents=True, exist_ok=False)
    files = args.output / "files"
    changes = []
    for name in sorted(plan["upload"]):
        target = files / public_path(name)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(site.site_bytes(name, local[name]))
        changes.append({"path": name, "before": remote.get(name), "after": file_sha256(target)})
    for name in sorted(plan["delete"]):
        changes.append({"path": name, "before": remote[name], "after": None})

    candidate = {"schema": SCHEMA, "pack": site.pack_version(), "base": base,
                 "archives": {"core": file_sha256(args.core), "deploy": file_sha256(args.deploy)},
                 "changes": changes, "held": sorted(held), "historyComplete": complete}
    (args.output / "candidate.json").write_text(json.dumps(candidate, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{candidate['pack']}: {len(changes)} proposed file changes, {len(held)} held")


def check(args):
    manifest = json.loads((args.candidate / "candidate.json").read_bytes())
    base = git(args.repo, "rev-parse", args.base_ref).decode().strip()
    if manifest["schema"] != SCHEMA or not PACK_VERSION.fullmatch(manifest["pack"]):
        raise ValueError("Invalid site candidate manifest")
    if not COMMIT_ID.fullmatch(manifest["base"]) or manifest["base"] != base:
        raise ValueError("The plan is out of date. main changed after it was prepared")
    archives = manifest["archives"]
    if set(archives) != {"core", "deploy"} or not all(SHA256.fullmatch(value) for value in archives.values()):
        raise ValueError("The candidate is missing the two archive checksums")
    if not isinstance(manifest["historyComplete"], bool):
        raise ValueError("The candidate is missing the history verification result")

    current = tree(args.repo, base)
    files = args.candidate / "files"
    listed, staged = set(), set()
    groups = {"Добавить": [], "Обновить": [], "Удалить": [], "Требуют сверки": []}
    for row in manifest["changes"]:
        name, before, after = row["path"], row["before"], row["after"]
        path = public_path(name)
        if name in listed or before != current.get(name) or (before is None and after is None):
            raise ValueError(f"Inconsistent candidate file: {name}")
        listed.add(name)
        if after is None:
            groups["Удалить"].append(name)
            continue
        file = files / path
        if (not file.is_file() or file.is_symlink() or
                not file.resolve().is_relative_to(files.resolve()) or not SHA256.fullmatch(after)):
            raise ValueError(f"Missing or invalid candidate file: {name}")
        if file_sha256(file) != after:
            raise ValueError(f"Candidate SHA-256 mismatch: {name}")
        if before and hashlib.sha256(git(args.repo, "cat-file", "blob", before)).hexdigest() == after:
            raise ValueError(f"Candidate marks an identical file as changed: {name}")
        staged.add(name)
        groups["Обновить" if before else "Добавить"].append(name)
    if {file.relative_to(files).as_posix() for file in files.rglob("*") if file.is_file()} != staged:
        raise ValueError("Candidate contains files outside its manifest")
    groups["Требуют сверки"] = [str(public_path(name)) for name in manifest["held"]]

    lines = [f"## План сайта {manifest['pack']}", "", f"База GitHub — `{base}`.", ""]
    for label, names in groups.items():
        lines.extend([f"### {label} — {len(names)}", ""])
        lines.extend(f"- `{name}`" for name in sorted(names))
        lines.append("")
    if not manifest["historyComplete"]:
        lines.append("Историю правок сайта нужно сверить перед выкладкой.")
    summary = "\n".join(lines) + "\n"
    if target := os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(target, "a", encoding="utf-8") as report:
            report.write(summary)
    print(summary, end="")
    if manifest["held"] or not manifest["historyComplete"]:
        raise ValueError("The candidate needs a review of editor changes before publication")


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    commands = cli.add_subparsers(dest="command", required=True)
    export = commands.add_parser("prepare")
    for name in ("pack_root", "core", "deploy", "sums", "repo", "output"):
        export.add_argument(name, type=Path)
    verify = commands.add_parser("check")
    verify.add_argument("candidate", type=Path)
    verify.add_argument("repo", type=Path)
    verify.add_argument("base_ref")
    args = cli.parse_args()
    try:
        (prepare if args.command == "prepare" else check)(args)
    except (OSError, KeyError, ValueError, subprocess.CalledProcessError) as error:
        cli.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
