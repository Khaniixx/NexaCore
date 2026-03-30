import subprocess

import pytest

from app.tools import open_url


def test_open_url_rejects_non_http_targets() -> None:
    with pytest.raises(ValueError, match="Only http and https URLs are supported"):
        open_url.open_url("file:///tmp/demo")


def test_open_url_invokes_node_launcher_for_valid_urls(monkeypatch) -> None:
    captured_command: list[str] = []

    def fake_run(command: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
        captured_command.extend(command)
        return subprocess.CompletedProcess(
            args=command,
            returncode=0,
            stdout='{"ok": true, "url": "https://example.com", "message": "Opened https://example.com in the default browser."}\n',
            stderr="",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    result = open_url.open_url("https://example.com")

    assert captured_command[0] == "node"
    assert captured_command[-1] == "https://example.com"
    assert result["ok"] is True
    assert result["url"] == "https://example.com"
