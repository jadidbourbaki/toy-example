from __future__ import annotations

from pathlib import Path

import pytest

from orla import tools


@pytest.mark.parametrize(
    ("expression", "expected"),
    [("2 + 3", "5"), ("2 + 3 * (4 - 1)", "11"), ("10 / 4", "2.5"), ("-3 + 1", "-2")],
)
def test_calculator_evaluates_arithmetic(expression: str, expected: str) -> None:
    assert tools.calculator(expression) == expected


@pytest.mark.parametrize(
    "expression",
    [
        '__import__("os").system("echo hi")',
        "open('/etc/passwd').read()",
        "1/0",
        "not an expression",
    ],
)
def test_calculator_refuses_anything_but_arithmetic(expression: str) -> None:
    assert tools.calculator(expression).startswith("calculator error:")


def test_search_policies_finds_a_matching_topic() -> None:
    assert "[refunds]" in tools.search_policies("can I get a refund")


def test_search_policies_says_so_when_nothing_matches() -> None:
    assert tools.search_policies("xylophone") == "No policy matched that query."


def test_create_ticket_numbers_each_ticket() -> None:
    first = tools.create_ticket("billing", "Charged twice for one order.")
    second = tools.create_ticket("billing", "Charged twice for one order.")
    assert first.startswith("Ticket #") and "billing team" in first
    assert first != second


def test_send_email_confirms_the_recipient_and_carries_the_whole_body() -> None:
    body = "Your refund is on its way.\nThanks for waiting."
    assert tools.send_email("the customer", body) == f"Sent to the customer: {body}"


def test_read_file_reads_inside_the_workspace(tmp_path: Path) -> None:
    (tmp_path / "note.txt").write_text("hello", encoding="utf-8")
    assert tools.make_read_file(tmp_path)("note.txt") == "hello"


def test_read_file_refuses_to_leave_the_workspace(tmp_path: Path) -> None:
    (tmp_path.parent / "secret.txt").write_text("no", encoding="utf-8")
    result = tools.make_read_file(tmp_path)("../secret.txt")
    assert result.startswith("read_file error: the path leaves")


def test_read_file_reports_a_missing_file(tmp_path: Path) -> None:
    assert tools.make_read_file(tmp_path)("absent.txt").startswith("read_file error:")


def test_call_reports_an_unknown_tool(tmp_path: Path) -> None:
    assert tools.call("nope", {}, tmp_path) == "unknown tool: nope"


def test_call_reports_a_wrong_argument(tmp_path: Path) -> None:
    assert tools.call("send_email", {"wrong": "x"}, tmp_path).startswith("send_email error:")


def test_the_registry_covers_the_catalog(tmp_path: Path) -> None:
    from orla.models import TOOL_CATALOG

    registry = tools.registry(tmp_path)
    assert {spec.id for spec in TOOL_CATALOG} == set(registry)
