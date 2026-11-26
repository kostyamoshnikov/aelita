import json
import unittest
from unittest.mock import patch

import cloudflare_html as cf


ADDRESS = b"contact@example.test"
ADDRESS_HASH = bytes([91, *(char ^ 91 for char in ADDRESS)]).hex().encode()
TOKEN = "a" * 32


def beacon(token):
    data = json.dumps({"token": token, "version": "2024.11.0", "r": 1, "spa": 2}).encode()
    return (
        b'<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js/v123a" '
        b'integrity="sha512-' + b"A" * 86 + b'==" data-cf-beacon=\'' + data
        + b'\' crossorigin="anonymous"></script>'
    )


class CloudflareHtmlTest(unittest.TestCase):
    def setUp(self):
        self.origin = b'<body><a href="mailto:' + ADDRESS + b'">' + ADDRESS + b'</a>\n</body>'
        protected = b'<span class="__cf_email__" data-cfemail="' + ADDRESS_HASH + b'">[email&#160;protected]</span>'
        decoder = b'<script data-cfasync="false" src="/cdn-cgi/scripts/ab12/cloudflare-static/email-decode.min.js"></script>'
        self.edge = (
            b'<body><a href="/cdn-cgi/l/email-protection#' + ADDRESS_HASH + b'">' + protected
            + b"</a>" + decoder + b"\n" + beacon(TOKEN) + b"\n</body>"
        )
        self.expected = cf.sha256(self.origin)
        token_hash = patch.object(cf, "BEACON_TOKEN_HASH", cf.sha256(TOKEN.encode()))
        token_hash.start()
        self.addCleanup(token_hash.stop)

    def test_exact_origin(self):
        self.assertEqual(cf.restore_body(self.edge, self.expected), self.origin)

    def test_other_content_and_analytics_account_fail(self):
        variants = [
            self.edge.replace(b"<body>", b"<body>changed", 1),
            self.edge.replace(beacon(TOKEN), beacon("b" * 32)),
            self.edge.replace(ADDRESS_HASH, b"abcd"),
        ]
        for changed in variants:
            with self.subTest(changed=changed[:30]):
                self.assertEqual(cf.restore_body(changed, self.expected), changed)

    def test_verifier_preserves_json_content(self):
        receipt = json.dumps({"files": {"index.html": self.expected, "index.json": self.expected}}).encode()
        get = lambda path: (200, receipt if path == "site-release-v1.json" else self.edge)

        def verify(read, *_):
            self.assertEqual(read("site-release-v1.json")[1], receipt)
            self.assertEqual(read("index.html")[1], self.origin)
            self.assertEqual(read("index.json")[1], self.edge)
            return {"ok": True}

        self.assertEqual(cf.verify_public(verify, get), {"ok": True, "cloudflare_html_normalized": 1})
