from dataclasses import dataclass
from datetime import date
from math import erfc, sqrt
from pathlib import Path

import duckdb


FUNNEL_SQL = (Path(__file__).resolve().parent / "sql" / "checkout_funnel.sql").read_text(encoding="utf-8")


def checkout_funnel(device):
    with duckdb.connect() as connection:
        connection.execute("""
            CREATE TABLE events AS
            SELECT device, week, session_id, event_name, event_order
            FROM (VALUES ('Mobile'), ('Desktop')) AS devices(device)
            CROSS JOIN (VALUES ('Prior week'), ('Recent week')) AS weeks(week)
            CROSS JOIN range(1000) AS sessions(session_id)
            CROSS JOIN (VALUES ('begin_checkout', 1), ('add_payment_info', 2),
                               ('purchase', 3)) AS steps(event_name, event_order)
            WHERE event_order = 1
               OR session_id < CASE
                   WHEN device = 'Mobile' AND week = 'Recent week'
                       THEN CASE WHEN event_order = 2 THEN 580 ELSE 493 END
                   ELSE CASE WHEN event_order = 2 THEN 720 ELSE 612 END
               END
        """)
        return connection.execute(FUNNEL_SQL, [device, device]).fetchall()


@dataclass(frozen=True)
class Arm:
    name: str
    assigned: int
    purchases: int

    @property
    def rate(self):
        return self.purchases / self.assigned


@dataclass(frozen=True)
class Readout:
    as_of: date
    control: Arm
    treatment: Arm

    @property
    def planned_date(self):
        return date(2026, 10, 15)

    @property
    def split_p_value(self):
        # Chi-square survival function for a 50/50 split with one degree of freedom.
        a, b = self.control.assigned, self.treatment.assigned
        return erfc(abs(a - b) / sqrt(2 * (a + b)))

    @property
    def status(self):
        if self.split_p_value < 0.01:
            return "Investigate assignment imbalance"
        if self.as_of < self.planned_date:
            return "Decision pending"
        return "Ready for analyst review"

    @property
    def effect(self):
        if self.status != "Ready for analyst review":
            return None
        a, b = self.control, self.treatment
        difference = b.rate - a.rate
        margin = 1.96 * sqrt(a.rate * (1 - a.rate) / a.assigned
                             + b.rate * (1 - b.rate) / b.assigned)
        return difference, difference - margin, difference + margin


SCENARIOS = {
    "In progress": Readout(date(2026, 10, 8), Arm("Control", 500, 300), Arm("Treatment", 500, 322)),
    "Completed": Readout(date(2026, 10, 15), Arm("Control", 2000, 1200), Arm("Treatment", 2000, 1290)),
    "Broken traffic split": Readout(date(2026, 10, 15), Arm("Control", 1800, 1080), Arm("Treatment", 2200, 1440)),
}


HYPOTHESIS = "Simplifying payment entry will increase completed purchases among mobile checkout starters."
DESIGN = (
    "Randomize eligible mobile checkout starters by user, 50/50, at checkout start.",
    "Primary metric: users purchasing within 24 hours divided by assigned users.",
    "Planned readout: October 15, 2026, after the final 24-hour window matures.",
    "Proposed guardrails: payment errors and refunds. Demo data covers the primary metric only.",
)
