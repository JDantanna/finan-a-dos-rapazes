#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]
use chrono::{Local, NaiveDate};
use norte_financas::State;
use rusqlite::{params, Connection};
use std::io::Read;
use std::{error::Error, path::PathBuf};
use tiny_http::{Header, Method, Response, Server, StatusCode};

fn main() {
    if let Err(e) = run() {
        eprintln!("Não foi possível iniciar o Finança dos Rapazes: {e}");
    }
}
fn run() -> Result<(), Box<dyn Error + Send + Sync>> {
    let dir = std::env::var_os("NORTE_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            std::env::var_os("APPDATA")
                .map(PathBuf::from)
                .unwrap_or_else(|| {
                    std::env::var_os("HOME")
                        .map(PathBuf::from)
                        .unwrap_or_else(std::env::temp_dir)
                })
                .join("NorteFinancas")
        });
    std::fs::create_dir_all(&dir)?;
    let mut db = Connection::open(dir.join("norte.sqlite"))?;
    db.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL); INSERT OR IGNORE INTO state VALUES (1, '{\"entries\":[],\"goals\":[]}');")?;
    let token = uuid::Uuid::new_v4().to_string();
    let server = Server::http("127.0.0.1:0")?;
    let address = server
        .server_addr()
        .to_ip()
        .ok_or("Endereço indisponível")?;
    let url = format!("http://{address}/");
    println!("NORTE_URL={url}");
    if std::env::var_os("NORTE_NO_OPEN").is_none() {
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("rundll32")
                .args(["url.dll,FileProtocolHandler", &url])
                .spawn()?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
        }
    }
    for mut req in server.incoming_requests() {
        let path = req.url().split('?').next().unwrap_or("/").to_string();
        let host_ok = req
            .headers()
            .iter()
            .any(|h| h.field.equiv("Host") && h.value.as_str() == address.to_string());
        let authenticated = req
            .headers()
            .iter()
            .any(|h| h.field.equiv("X-Norte-Token") && h.value.as_str() == token);
        let result: Result<(String, &'static str), String> = (|| {
            if !host_ok {
                return Err("Host inválido".into());
            }
            if path == "/" && req.method() == &Method::Get {
                return Ok((
                    include_str!("../ui/index.html").replace("__TOKEN__", &token),
                    "text/html; charset=utf-8",
                ));
            }
            if path == "/style.css" && req.method() == &Method::Get {
                return Ok((
                    include_str!("../ui/style.css").into(),
                    "text/css; charset=utf-8",
                ));
            }
            if path == "/currency-input.js" && req.method() == &Method::Get {
                return Ok((include_str!("../ui/currency-input.js").into(), "text/javascript; charset=utf-8"));
            }
            if path == "/app.js" && req.method() == &Method::Get {
                return Ok((
                    include_str!("../ui/app.js").into(),
                    "text/javascript; charset=utf-8",
                ));
            }
            if !authenticated {
                return Err("Acesso não autorizado".into());
            }
            let body: String = db
                .query_row("SELECT body FROM state WHERE id=1", [], |r| r.get(0))
                .map_err(|e| e.to_string())?;
            if path == "/api/state" && req.method() == &Method::Get {
                return Ok((body, "application/json"));
            }
            if path == "/api/state" && req.method() == &Method::Post {
                let mut input = String::new();
                std::io::Read::take(req.as_reader(), 4_000_001)
                    .read_to_string(&mut input)
                    .map_err(|e| e.to_string())?;
                if input.len() > 4_000_000 {
                    return Err("Arquivo muito grande".into());
                }
                let state: State = serde_json::from_str(&input).map_err(|_| "Dados inválidos")?;
                state.validate()?;
                let json = serde_json::to_string(&state).map_err(|e| e.to_string())?;
                let tx = db.transaction().map_err(|e| e.to_string())?;
                tx.execute("UPDATE state SET body=?1 WHERE id=1", params![json])
                    .map_err(|e| e.to_string())?;
                tx.commit().map_err(|e| e.to_string())?;
                return Ok(("{\"ok\":true}".into(), "application/json"));
            }
            if path == "/api/report" && req.method() == &Method::Get {
                let query = req.url().split_once('?').map(|(_, q)| q).unwrap_or("");
                let arg = |key: &str| {
                    query
                        .split('&')
                        .find_map(|s| s.split_once('=').filter(|(k, _)| *k == key).map(|(_, v)| v))
                };
                let start = arg("start")
                    .ok_or("Data inicial ausente")?
                    .parse::<NaiveDate>()
                    .map_err(|_| "Data inválida")?;
                let end = arg("end")
                    .ok_or("Data final ausente")?
                    .parse::<NaiveDate>()
                    .map_err(|_| "Data inválida")?;
                if end < start || (end - start).num_days() > 3660 {
                    return Err("Período inválido (máximo 10 anos)".into());
                }
                let state: State = serde_json::from_str(&body).map_err(|e| e.to_string())?;
                return Ok((
                    serde_json::to_string(&state.report(start, end, Local::now().date_naive()))
                        .map_err(|e| e.to_string())?,
                    "application/json",
                ));
            }
            Err("Recurso indisponível".into())
        })();
        let (status, body, mime) = match result {
            Ok((b, m)) => (200, b, m),
            Err(e) => (
                400,
                serde_json::json!({"error":e}).to_string(),
                "application/json",
            ),
        };
        let mut response = Response::from_string(body).with_status_code(StatusCode(status));
        for (name,value) in [("Content-Type",mime),("Cache-Control","no-store"),("X-Content-Type-Options","nosniff"),("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")] { response.add_header(Header::from_bytes(name,value).unwrap()); }
        let _ = req.respond(response);
    }
    Ok(())
}
