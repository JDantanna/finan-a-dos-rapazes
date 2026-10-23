use chrono::{Datelike, Duration, Months, NaiveDate};
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Entry {
    pub id: String,
    pub description: String,
    pub kind: String,
    pub cents: i64,
    pub category: String,
    pub source: String,
    #[serde(default)]
    pub account: String,
    pub date: NaiveDate,
    pub frequency: String,
    pub end_date: Option<NaiveDate>,
}
#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Goal {
    pub id: String,
    pub name: String,
    pub target: i64,
    pub saved: i64,
    pub deadline: NaiveDate,
}
#[derive(Clone, Default, Serialize, Deserialize)]
pub struct State {
    pub entries: Vec<Entry>,
    pub goals: Vec<Goal>,
    #[serde(default)]
    pub demo: bool,
}
#[derive(Serialize)]
pub struct Occurrence {
    pub entry: Entry,
    pub date: NaiveDate,
}
#[derive(Serialize)]
pub struct GoalPlan {
    pub id: String,
    pub monthly: i64,
    pub overdue: bool,
}
#[derive(Serialize)]
pub struct Report {
    pub income: i64,
    pub expense: i64,
    pub balance: i64,
    pub occurrences: Vec<Occurrence>,
    pub plans: Vec<GoalPlan>,
    pub monthly_required: i64,
}
impl State {
    pub fn validate(&self) -> Result<(), String> {
        if self.entries.len() > 100_000 || self.goals.len() > 1000 {
            return Err("Limite de registros excedido".into());
        }
        let mut ids = std::collections::HashSet::new();
        for e in &self.entries {
            if e.id.is_empty()
                || !ids.insert(&e.id)
                || e.description.trim().is_empty()
                || e.description.len() > 200
                || e.source.trim().is_empty()
                || e.source.len() > 120
                || e.account.len() > 120
                || e.category.trim().is_empty()
                || e.category.len() > 80
                || !(1..=100_000_000_000).contains(&e.cents)
                || !["income", "expense"].contains(&e.kind.as_str())
                || !["once", "weekly", "fortnightly", "monthly", "yearly"]
                    .contains(&e.frequency.as_str())
                || e.end_date.is_some_and(|d| d < e.date)
                || !(1900..=2200).contains(&e.date.year())
            {
                return Err("Confira os campos do lançamento".into());
            }
        }
        ids.clear();
        for g in &self.goals {
            if g.id.is_empty()
                || !ids.insert(&g.id)
                || g.name.trim().is_empty()
                || g.name.len() > 200
                || !(1..=100_000_000_000).contains(&g.target)
                || g.saved < 0
                || g.saved > g.target
                || !(1900..=2200).contains(&g.deadline.year())
            {
                return Err("Confira os campos da meta".into());
            }
        }
        Ok(())
    }
    pub fn report(&self, start: NaiveDate, end: NaiveDate, today: NaiveDate) -> Report {
        let mut occurrences = Vec::new();
        for e in &self.entries {
            // Always advance from the original anchor: Jan 31 -> Feb 28 -> Mar 31.
            for n in 0..16000u32 {
                let date = match e.frequency.as_str() {
                    "once" if n == 0 => Some(e.date),
                    "weekly" => e.date.checked_add_signed(Duration::days(i64::from(n) * 7)),
                    "fortnightly" => e.date.checked_add_signed(Duration::days(i64::from(n) * 15)),
                    "monthly" => e.date.checked_add_months(Months::new(n)),
                    "yearly" => e.date.checked_add_months(Months::new(n * 12)),
                    _ => None,
                };
                let Some(date) = date else {
                    break;
                };
                if date > end || e.end_date.is_some_and(|d| date > d) {
                    break;
                }
                if date >= start {
                    occurrences.push(Occurrence {
                        entry: e.clone(),
                        date,
                    });
                }
            }
        }
        occurrences.sort_by_key(|o| o.date);
        let income = occurrences
            .iter()
            .filter(|o| o.entry.kind == "income")
            .map(|o| o.entry.cents)
            .sum::<i64>();
        let expense = occurrences
            .iter()
            .filter(|o| o.entry.kind == "expense")
            .map(|o| o.entry.cents)
            .sum::<i64>();
        let plans: Vec<_> = self
            .goals
            .iter()
            .map(|g| {
                let months = ((g.deadline.year() - today.year()) * 12 + g.deadline.month() as i32
                    - today.month() as i32
                    + 1)
                .max(1) as i64;
                let remaining = (g.target - g.saved).max(0);
                GoalPlan {
                    id: g.id.clone(),
                    monthly: (remaining + months - 1) / months,
                    overdue: g.deadline < today && remaining > 0,
                }
            })
            .collect();
        let monthly_required = plans.iter().map(|p| p.monthly).sum();
        Report {
            income,
            expense,
            balance: income - expense,
            occurrences,
            plans,
            monthly_required,
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn d(s: &str) -> NaiveDate {
        s.parse().unwrap()
    }
    fn sample(f: &str) -> State {
        State {
            entries: vec![Entry {
                id: "a".into(),
                description: "Teste".into(),
                kind: "expense".into(),
                cents: 12345,
                category: "Casa".into(),
                source: "Banco".into(),
                account: String::new(),
                date: d("2026-01-31"),
                frequency: f.into(),
                end_date: None,
            }],
            goals: vec![],
            demo: false,
        }
    }
    #[test]
    fn month_anchor_and_totals() {
        let r = sample("monthly").report(d("2026-02-01"), d("2026-03-31"), d("2026-02-01"));
        assert_eq!(
            r.occurrences.iter().map(|o| o.date).collect::<Vec<_>>(),
            vec![d("2026-02-28"), d("2026-03-31")]
        );
        assert_eq!(r.expense, 24690);
        assert_eq!(r.balance, -24690);
    }
    #[test]
    fn fifteen_days_is_not_twice_monthly() {
        let r = sample("fortnightly").report(d("2026-01-01"), d("2026-03-02"), d("2026-01-01"));
        assert_eq!(r.occurrences.len(), 3);
        assert_eq!(r.occurrences[2].date, d("2026-03-02"));
    }
    #[test]
    fn once_and_end_date() {
        let mut s = sample("monthly");
        s.entries[0].end_date = Some(d("2026-02-28"));
        assert_eq!(
            s.report(d("2026-01-01"), d("2026-12-31"), d("2026-01-01"))
                .occurrences
                .len(),
            2
        );
        assert_eq!(
            sample("once")
                .report(d("2026-02-01"), d("2026-12-31"), d("2026-01-01"))
                .expense,
            0
        );
    }
    #[test]
    fn leap_anchor() {
        let mut s = sample("yearly");
        s.entries[0].date = d("2024-02-29");
        let r = s.report(d("2025-01-01"), d("2028-12-31"), d("2025-01-01"));
        assert_eq!(r.occurrences.last().unwrap().date, d("2028-02-29"));
    }
    #[test]
    fn goal_round_up_and_overdue() {
        let mut s = State::default();
        s.goals.push(Goal {
            id: "g".into(),
            name: "Carro".into(),
            target: 10000,
            saved: 0,
            deadline: d("2026-03-31"),
        });
        let r = s.report(d("2026-01-01"), d("2026-01-31"), d("2026-01-01"));
        assert_eq!(r.monthly_required, 3334);
        assert!(
            s.report(d("2026-04-01"), d("2026-04-30"), d("2026-04-01"))
                .plans[0]
                .overdue
        );
    }
    #[test]
    fn rejects_bad_values() {
        let mut s = sample("once");
        s.entries[0].cents = -1;
        assert!(s.validate().is_err());
        s.entries[0].cents = 1;
        s.entries.push(s.entries[0].clone());
        assert!(s.validate().is_err());
    }
}

#[cfg(test)]
mod account_compatibility_tests {
    use super::*;
    #[test]
    fn legacy_source_is_preserved() {
        let old = r#"{"id":"old","description":"Receita antiga","kind":"income","cents":10000,"category":"Salário","source":"Conta antiga","date":"2026-10-01","frequency":"once","end_date":null}"#;
        let mut entry: Entry = serde_json::from_str(old).unwrap();
        assert_eq!(entry.source, "Conta antiga");
        assert_eq!(entry.account, "");
        entry.source="Empresa de exemplo".into();
        entry.account="Conta Nubank".into();
        let roundtrip:Entry=serde_json::from_str(&serde_json::to_string(&entry).unwrap()).unwrap();
        assert_eq!(roundtrip.account,"Conta Nubank");
        assert_eq!(roundtrip.source,"Empresa de exemplo");
    }
}
