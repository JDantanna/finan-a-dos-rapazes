use crate::finance::{Entry, State};
use chrono::{Datelike, Months};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct Purchase {
    pub entry: Entry,
    pub count: u32,
}

pub fn expand(purchase: Purchase) -> Result<Vec<Entry>, String> {
    let Purchase { entry, count } = purchase;
    State { entries: vec![entry.clone()], ..Default::default() }.validate()?;
    if entry.kind != "expense" || entry.frequency != "once" || !(2..=120).contains(&count) || entry.cents < i64::from(count) {
        return Err("Informe uma despesa, de 2 a 120 parcelas e ao menos um centavo por parcela".into());
    }
    let base = entry.cents / i64::from(count);
    let remainder = entry.cents % i64::from(count);
    let mut entries = Vec::with_capacity(count as usize);
    for n in 0..count {
        let date = entry.date.checked_add_months(Months::new(n)).filter(|date| date.year() <= 2200)
            .ok_or("As parcelas ultrapassam o limite de datas")?;
        let mut part = entry.clone();
        part.id = format!("{}-p{}", entry.id, n + 1);
        part.description = format!("{} · parcela {}/{}", entry.description, n + 1, count);
        part.cents = base + i64::from(i64::from(n) < remainder);
        part.date = date;
        part.end_date = None;
        entries.push(part);
    }
    State { entries: entries.clone(), ..Default::default() }.validate()?;
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn purchase(total:i64,count:u32,date:&str)->Purchase {
        Purchase { count, entry: Entry { id:"purchase".into(),description:"Notebook".into(),kind:"expense".into(),cents:total,category:"Outros".into(),source:"Cartão Nubank".into(),account:String::new(),date:date.parse().unwrap(),frequency:"once".into(),end_date:None } }
    }
    #[test]
    fn exact_total_and_monthly_expenses() {
        let entries=expand(purchase(10001,4,"2026-01-31")).unwrap();
        assert_eq!(entries.iter().map(|e|e.cents).collect::<Vec<_>>(),vec![2501,2500,2500,2500]);
        assert_eq!(entries.iter().map(|e|e.date.to_string()).collect::<Vec<_>>(),vec!["2026-01-31","2026-02-28","2026-03-31","2026-04-30"]);
        let state=State{entries,..Default::default()};
        let report=state.report("2026-01-01".parse().unwrap(),"2026-12-31".parse().unwrap(),"2026-01-01".parse().unwrap());
        assert_eq!(report.expense,10001);
        assert_eq!(report.occurrences.len(),4);
        assert_eq!(state.report("2026-02-01".parse().unwrap(),"2026-02-28".parse().unwrap(),"2026-01-01".parse().unwrap()).expense,2500);
        assert_eq!(state.report("2026-05-01".parse().unwrap(),"2026-05-31".parse().unwrap(),"2026-01-01".parse().unwrap()).expense,0);
    }
    #[test]
    fn leap_year_and_year_rollover() {
        assert_eq!(expand(purchase(100,3,"2027-12-31")).unwrap()[2].date.to_string(),"2028-02-29");
    }
    #[test]
    fn rejects_invalid_purchase() {
        for (total,count) in [(100,0),(100,1),(10000,121),(3,4)] { assert!(expand(purchase(total,count,"2026-01-01")).is_err()); }
        assert!(expand(purchase(100,2,"2200-12-01")).is_err());
        let mut p=purchase(100,2,"2026-01-01");p.entry.kind="income".into();assert!(expand(p).is_err());
    }
}
