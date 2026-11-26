#!/usr/bin/env python3
"""Run the pinned AELITA pack's normal release process on Linux."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from email.utils import parsedate_to_datetime
from pathlib import Path

import cloudflare_html

REPO = "kostyamoshnikov/aelita"
PARTS = ("core", "deploy")
S3_KEYS = ("YC_S3_KEY_ID", "YC_S3_SECRET")
RELEASE_S3_KEYS = ("AELITA_RELEASE_S3_KEY_ID", "AELITA_RELEASE_S3_SECRET")
BOOTSTRAP = "_tools/SiteDeploy/termux/deploy_aelita.sh"
CONFIRM = "Выложить? Enter — да, n — нет: "
MONEY_CONFIRM = "Обновить и денежные? y — да, Enter — нет: "


class ReleaseError(ValueError):
    pass


def request_at(path):
    return validate_request(json.loads(path.read_text(encoding="utf-8")))


def validate_request(request):
    fields = {"version", "core_sha256", "deploy_sha256", "money"}
    if not isinstance(request, dict) or set(request) - {"bot"} != fields:
        raise ReleaseError("Неверные поля запроса на выкладку.")
    if type(request["version"]) is not int or request["version"] <= 0:
        raise ReleaseError("Неверная версия пака.")
    if type(request["money"]) is not bool:
        raise ReleaseError("Денежный режим задаётся явно через money.")
    if request.get("bot", "auto") not in ("auto", "manual"):
        raise ReleaseError("Для бота укажите auto или manual.")
    for part in PARTS:
        digest = request[f"{part}_sha256"]
        if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise ReleaseError(f"Неверная контрольная сумма {part}.")
    return request


def transfer_parts(directory, request, upload=False):
    bucket = os.environ.get("AELITA_RELEASE_BUCKET", "")
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,61}[a-z0-9]", bucket):
        raise ReleaseError("Нужен закрытый бакет AELITA_RELEASE_BUCKET.")
    access_key, secret_key = RELEASE_S3_KEYS if any(os.environ.get(name) for name in RELEASE_S3_KEYS) else S3_KEYS
    require_keys((access_key, secret_key))
    s3_env = {
        "HOME": os.environ["HOME"],
        "PATH": os.environ["PATH"],
        "AWS_ACCESS_KEY_ID": os.environ[access_key],
        "AWS_SECRET_ACCESS_KEY": os.environ[secret_key],
        "AWS_DEFAULT_REGION": "ru-central1",
        "AWS_EC2_METADATA_DISABLED": "true",
        "AWS_PAGER": "",
    }
    version = request["version"]
    for part in PARTS:
        filename = f"AELITA_{part}-v{version}.zip"
        operation = "put-object" if upload else "get-object"
        file_args = ["--body", str(directory / filename)] if upload else [str(directory / filename)]
        call = subprocess.run([
            "aws", "s3api", operation, "--endpoint-url", "https://storage.yandexcloud.net",
            "--bucket", bucket, "--key", f"releases/pack-v{version}/{filename}",
            *file_args,
        ], env=s3_env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=600)
        if call.returncode:
            action = "загрузить в закрытый бакет" if upload else "получить из закрытого бакета"
            raise ReleaseError(f"Не удалось {action} {filename}.")


def require_keys(names):
    missing = [name for name in names if not os.environ.get(name)]
    if missing:
        raise ReleaseError("Для выкладки нужно настроить доступы " + ", ".join(missing) + ".")


def verify_and_unpack(home, archives, request):
    version = request["version"]
    downloads = home / "storage/shared/Download"
    downloads.mkdir(parents=True)
    for part in PARTS:
        name = f"AELITA_{part}-v{version}.zip"
        archive = archives / name
        if not archive.is_file():
            raise ReleaseError(f"Отсутствует {name}.")
        with archive.open("rb") as source:
            if hashlib.file_digest(source, "sha256").hexdigest() != request[f"{part}_sha256"]:
                raise ReleaseError(f"Контрольная сумма {name} не совпала.")
        (downloads / name).symlink_to(archive.resolve())

    bootstrap = home / "bootstrap.sh"
    with zipfile.ZipFile(downloads / f"AELITA_core-v{version}.zip") as core:
        bootstrap.write_bytes(core.read(BOOTSTRAP))
    offline_env = {"HOME": str(home), "PATH": os.environ["PATH"], "LANG": "C.UTF-8"}
    result = subprocess.run(
        ["bash", str(bootstrap), "plan"], env=offline_env, stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=600,
    )
    if result.returncode:
        raise ReleaseError("Штатная проверка целостности или построение плана завершились ошибкой.")
    return home / f"AELITA-v{version}"


def require_current_version(actual, intended, component):
    match = re.fullmatch(r"(?:pack-v|aelita-v)?(\d+)", str(actual))
    if match and int(match[1]) > intended:
        raise ReleaseError(f"{component}: уже выпущена более новая версия.")


def require_current_site(candidate):
    # The branch commit is authoritative while Pages is still publishing.
    url = f"https://raw.githubusercontent.com/{REPO}/main/site-release-v1.json"
    try:
        current = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
        with urllib.request.urlopen(current, timeout=15) as resp:
            receipt = json.load(resp)
    except (OSError, ValueError):
        raise ReleaseError("Не удалось проверить последнюю версию сайта в GitHub.") from None
    if not isinstance(receipt, dict) or not re.fullmatch(r"pack-v\d+", str(receipt.get("release"))):
        raise ReleaseError("Опись текущей версии сайта в GitHub повреждена.")
    require_current_version(receipt["release"], candidate, "Сайт")


def require_idle_cloud(phone, state):
    # An existing Termux upload may be waiting for its report.
    storage = phone.fs.mb.S3(phone.fs.BUCKET, *phone.fs.read_key())
    uploaded, archive, _ = storage.request("HEAD", phone.fs.ARCHIVE_KEY)
    if uploaded == 404:
        return
    reported, report, _ = storage.request("HEAD", phone.fs.REPORT_KEY)
    if uploaded != 200 or reported != 200 or not archive.get("last-modified") or not report.get("last-modified"):
        raise ReleaseError("Последняя облачная выкладка ещё не подтверждена.")
    if parsedate_to_datetime(archive["last-modified"]) > parsedate_to_datetime(report["last-modified"]):
        raise ReleaseError("Облако ещё не выдало отчёт по последнему запуску. Проверьте Termux doctor.")
    archive_etag = archive.get("etag", "").strip('"')
    report_etag = str((state.get("report") or {}).get("archiveEtag") or "").strip('"')
    if not archive_etag or archive_etag != report_etag:
        raise ReleaseError("Последний облачный отчёт относится к другому архиву. Проверьте Termux doctor.")


def apply_pack(root, request):
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(root / "_tools/Deploy"))
    import phone

    version = request["version"]
    plan = phone.load_vj()
    if not phone._release_allows_live(root, "run"):
        raise ReleaseError("У пака нет разрешения на полную выкладку.")
    if any((plan.get("manual") or {}).values()):
        raise ReleaseError("В этом выпуске есть ручные шаги. Используйте Termux.")
    if request.get("bot") == "manual":
        plan = {**plan, "workers": []}
        phone.load_vj = lambda: plan
    if plan.get("workers"):
        require_keys(["CLOUDFLARE_API_TOKEN"])

    def checked_cloud():
        client, state, error = cloud()
        if error:
            raise ReleaseError("Не удалось проверить текущее состояние функций.")
        require_current_version((state.get("state") or {}).get("version"), version, "Функции")
        return client, state, error

    def checked_plan(functions, site, workers, extras, pack_version, site_version, only):
        if site and site["status"] not in ("go", "same"):
            raise ReleaseError(f"Выкладка сайта остановлена планом ({site['status']}).")
        if workers and workers["status"] not in ("go", "none"):
            raise ReleaseError(f"Выкладка бота остановлена планом ({workers['status']}).")
        if workers and workers["status"] == "go":
            items = workers["items"]
            if len(items) != len(workers["names"]) or any(item["status"] != "go" for item in items):
                raise ReleaseError("Часть воркеров требует ручной настройки.")
        return show_plan(functions, site, workers, extras, pack_version, site_version, only)

    def check_live_and_confirm(prompt):
        if prompt != CONFIRM:
            return requires_operator()
        _, current, _ = checked_cloud()
        require_idle_cloud(phone, current)
        require_current_site(version)
        require_current_version(phone.live_site_version(), int(plan["site_version"]), "Сайт")
        if plan.get("workers"):
            require_current_version(phone.bot_status().get("version"), version, "Бот")
        return True

    def money_confirm(prompt):
        if prompt != MONEY_CONFIRM:
            return requires_operator()
        return request["money"]

    def requires_operator(*_):
        raise ReleaseError("Нужен ручной шаг в Termux.")

    cloud = phone.s3_snapshot
    show_plan = phone.show_plan
    verify = phone.ds.site_changes.verify_public
    phone.ds.site_changes.verify_public = lambda get, receipt=None, **options: cloudflare_html.verify_public(
        verify, get, receipt, **options
    )
    phone.s3_snapshot = checked_cloud
    phone.show_plan = checked_plan
    phone.ask_yes_default = check_live_and_confirm
    phone.ask_no_default = money_confirm
    phone.ask_raw = phone.ask = phone.secret = requires_operator
    # Customer data backups retain their existing manual command.
    phone.backup_age_days = lambda: 0
    require_current_site(version)
    return phone.main(["run"])


def deploy(request, local_archives=None):
    with tempfile.TemporaryDirectory(prefix="aelita-release-") as directory:
        workspace = Path(directory)
        archives = local_archives if local_archives else workspace / "archives"
        if local_archives is None:
            require_keys((*S3_KEYS, "GITHUB_TOKEN"))
            archives.mkdir()
            transfer_parts(archives, request)
        home = workspace / "operator"
        root = verify_and_unpack(home, archives, request)
        if local_archives is not None:
            print(f"pack-v{request['version']}: целостность и штатный план проверены.")
            return 0
        config = {key: value for key, value in os.environ.items() if key not in RELEASE_S3_KEYS}
        config.update(HOME=str(home), AELITA_HOME=str(home), AELITA_DL=str(home / "storage/shared/Download"),
                      GITHUB_REPO=REPO, GITHUB_BRANCH="main")
        # Production logs can contain internal metadata. Only publish stage
        # outcomes to the public repository.
        result = subprocess.run(
            [sys.executable, __file__, "_apply", str(root), json.dumps(request)],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            env=config, timeout=2100,
        )
        history = home / ".aelita_deploys.json"
        if history.is_file():
            publish_summary(history, request.get("bot") == "manual")
        if result.returncode:
            raise ReleaseError("Штатная выкладка не подтверждена. Сверьте версии через Termux doctor.")
        return 0


def stage(archives, version, money, manual_bot=False):
    request = {"version": version, "money": money}
    if manual_bot:
        request["bot"] = "manual"
    for part in PARTS:
        with (archives / f"AELITA_{part}-v{version}.zip").open("rb") as source:
            request[f"{part}_sha256"] = hashlib.file_digest(source, "sha256").hexdigest()
    validate_request(request)
    with tempfile.TemporaryDirectory(prefix="aelita-stage-") as tmp:
        root = verify_and_unpack(Path(tmp) / "operator", archives, request)
        manifest = json.loads((root / "MANIFEST.json").read_text(encoding="utf-8"))
        control = manifest.get("release_control") or {}
        if control.get("production_authorized") is not True or control.get("status") not in ("APPROVED", "OWNER_CONTROLLED"):
            raise ReleaseError("Для очереди нужен утверждённый рабочий выпуск.")
        if (root / f"Documents/Instructions/v{version}/WIP_DO_NOT_DEPLOY").exists():
            raise ReleaseError("Пак помечен как черновик.")
        transfer_parts(archives, request, upload=True)
    print(json.dumps(request, indent=2))
    return 0


def publish_summary(history, manual_bot=False):
    records = json.loads(history.read_text(encoding="utf-8"))
    if not isinstance(records, list) or not records or not isinstance(records[-1], dict):
        return
    last = records[-1]
    print("Функции:", last.get("functions") or "без новой записи")
    print("Сайт:", last.get("site") or "без новой записи")
    bot_status = "ручная выкладка через Termux" if manual_bot else (last.get("workers") or {}).get("aelita-bot")
    print("Бот:", bot_status or "без новой записи")
    if last.get("checks"):
        print("Проверки:", "/".join(map(str, last["checks"])))


def self_test():
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "release.json"
        draft = {"version": 1066, "core_sha256": "a" * 64, "deploy_sha256": "b" * 64, "money": False}
        path.write_text(json.dumps(draft))
        if request_at(path) != draft:
            raise ReleaseError("Проверка запроса не пройдена.")
        if validate_request({**draft, "bot": "manual"})["bot"] != "manual":
            raise ReleaseError("Не принят ручной режим бота.")
        for changes in ({"version": True}, {"money": "false"}, {"core_sha256": "../release.zip"}, {"bot": "skip"}):
            path.write_text(json.dumps({**draft, **changes}))
            try:
                request_at(path)
            except ReleaseError:
                continue
            raise ReleaseError("Принят неверный запрос.")
    require_current_version("pack-v1066", 1066, "Функции")
    try:
        require_current_version("pack-v1067", 1066, "Функции")
    except ReleaseError:
        print("Проверки запроса и защиты от более старого выпуска пройдены.")
        return 0
    raise ReleaseError("Принят более старый выпуск.")


def main():
    parser = argparse.ArgumentParser()
    modes = parser.add_subparsers(dest="mode", required=True)
    modes.add_parser("self-test")
    for mode in ("validate", "verify", "deploy"):
        command = modes.add_parser(mode)
        command.add_argument("request", type=Path)
        if mode == "verify":
            command.add_argument("archives", type=Path)
    command = modes.add_parser("stage")
    command.add_argument("archives", type=Path)
    command.add_argument("version", type=int)
    command.add_argument("--money", action="store_true")
    command.add_argument("--manual-bot", action="store_true")
    command = modes.add_parser("_apply")
    command.add_argument("root", type=Path)
    command.add_argument("data")
    args = parser.parse_args()

    try:
        if args.mode == "self-test":
            return self_test()
        if args.mode == "_apply":
            return apply_pack(args.root, json.loads(args.data))
        if args.mode == "stage":
            return stage(args.archives, args.version, args.money, args.manual_bot)
        request = request_at(args.request)
        if args.mode == "validate":
            print(f"Запрос для pack-v{request['version']} проверен.")
            return 0
        return deploy(request, getattr(args, "archives", None))
    except (ReleaseError, OSError, subprocess.SubprocessError, zipfile.BadZipFile, json.JSONDecodeError) as exc:
        if isinstance(exc, ReleaseError):
            print(exc, file=sys.stderr)
        else:
            print(f"Проверка или выкладка остановлена ({type(exc).__name__}).", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
