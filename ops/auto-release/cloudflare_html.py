"""Verify published HTML with AELITA's Cloudflare transformations enabled."""
import hashlib
import json
import re

# Fingerprint of the public Web Analytics site identifier for aelita-production.ru.
BEACON_TOKEN_HASH = "17c100c1b4e1136a6059b530c96be37fbb834c12f4cc1e80e390f25e78f5e5d5"
BEACON = re.compile(
    rb'<script type="module" src="https://static\.cloudflareinsights\.com/beacon\.min\.js/v[0-9a-f]+" '
    rb'integrity="sha512-[A-Za-z0-9+/]{86}==" data-cf-beacon=\'([^\x00-\x1f<>\']{1,1024})\' '
    rb'crossorigin="anonymous"></script>(?=\r?\n?</body>)'
)
DECODER = re.compile(
    rb'<script data-cfasync="false" src="/cdn-cgi/scripts/[a-f0-9]+/cloudflare-static/email-decode\.min\.js"'
    rb'(?: defer)?></script>'
)
PROTECTED_TEXT = re.compile(
    rb'(?:<a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="([a-f0-9]+)">'
    rb'\[email&#160;protected\]</a>|<span class="__cf_email__" data-cfemail="([a-f0-9]+)">'
    rb'\[email&#160;protected\]</span>)'
)
PROTECTED_LINK = re.compile(rb'href="/cdn-cgi/l/email-protection#([a-f0-9]+)"')
EMAIL = re.compile(rb"[A-Za-z0-9_+.!%-]+@[A-Za-z0-9.-]+\.[A-Za-z0-9-]+")
MAILTO_QUERY = re.compile(rb"[-A-Za-z0-9%._~+&=]*")


def sha256(body):
    return hashlib.sha256(body).hexdigest()


def decode_address(payload, allow_query=False):
    try:
        encoded = bytes.fromhex(payload.decode("ascii"))
    except ValueError:
        return None
    if len(encoded) < 2:
        return None
    decoded = bytes(char ^ encoded[0] for char in encoded[1:])
    address, separator, query = decoded.partition(b"?")
    if not EMAIL.fullmatch(address) or (separator and (not allow_query or not MAILTO_QUERY.fullmatch(query))):
        return None
    return decoded


def restore_text(match):
    return decode_address(match[1] or match[2]) or match[0]


def restore_link(match):
    decoded = decode_address(match[1], allow_query=True)
    return b'href="mailto:' + decoded + b'"' if decoded else match[0]


def known_beacon(match):
    try:
        data = json.loads(match[1])
    except (ValueError, UnicodeDecodeError):
        return False
    if not isinstance(data, dict) or set(data) != {"token", "version", "r", "spa"}:
        return False
    token = data["token"]
    return (
        isinstance(token, str) and re.fullmatch(r"[a-f0-9]{32}", token) is not None
        and sha256(token.encode("ascii")) == BEACON_TOKEN_HASH
        and isinstance(data["version"], str) and re.fullmatch(r"\d+\.\d+\.\d+", data["version"]) is not None
        and type(data["r"]) is int and data["r"] == 1 and type(data["spa"]) is int and data["spa"] == 2
    )


def restore_body(body, expected):
    if sha256(body) == expected:
        return body
    restored = PROTECTED_LINK.sub(restore_link, PROTECTED_TEXT.sub(restore_text, body))
    if restored != body:
        restored = DECODER.sub(b"", restored)
    match = BEACON.search(restored)
    if match and known_beacon(match):
        tail = restored[match.end():]
        for candidate_tail in (tail, tail.removeprefix(b"\r\n").removeprefix(b"\n")):
            candidate = restored[:match.start()] + candidate_tail
            if sha256(candidate) == expected:
                return candidate
    return restored if sha256(restored) == expected else body


def verify_public(verify, get, expected_receipt=None, **options):
    files = {}
    resolved = set()

    def read(path):
        status, body = get(path)
        if path == "site-release-v1.json":
            try:
                receipt = json.loads(body)
                indexed = receipt.get("files") if isinstance(receipt, dict) else None
                if isinstance(indexed, dict):
                    files.update(indexed)
            except (ValueError, TypeError):
                pass  # The original verifier validates the receipt.
        elif status == 200 and path.endswith(".html") and path in files and isinstance(body, bytes):
            restored = restore_body(body, files[path])
            if restored != body:
                resolved.add(path)
            body = restored
        return status, body

    result = verify(read, expected_receipt, **options)
    if resolved:
        result["cloudflare_html_normalized"] = len(resolved)
    return result
