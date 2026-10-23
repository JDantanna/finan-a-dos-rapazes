mod finance;
mod installments;
use chrono::NaiveDate;
use serde::Deserialize;
#[derive(Deserialize)]
struct Input { state: finance::State, start: NaiveDate, end: NaiveDate, today: NaiveDate }
fn run(bytes: &[u8]) -> Result<serde_json::Value,String> {
    let value: serde_json::Value = serde_json::from_slice(bytes).map_err(|_|"Dados inválidos".to_string())?;
    if let Some(purchase) = value.get("installments") {
        let purchase: installments::Purchase = serde_json::from_value(purchase.clone()).map_err(|_|"Compra parcelada inválida".to_string())?;
        return serde_json::to_value(installments::expand(purchase)?).map_err(|e|e.to_string());
    }
    let input: Input=serde_json::from_value(value).map_err(|_|"Dados inválidos".to_string())?;
    input.state.validate()?;
    if input.end<input.start || (input.end-input.start).num_days()>3660 { return Err("Período inválido".into()); }
    serde_json::to_value(input.state.report(input.start,input.end,input.today)).map_err(|e|e.to_string())
}
#[no_mangle]
pub extern "C" fn allocate(len: usize)->*mut u8 { Box::into_raw(vec![0u8;len].into_boxed_slice()) as *mut u8 }
/// The caller must pass a buffer from allocate, exactly once, with its original length.
#[no_mangle]
pub unsafe extern "C" fn calculate(ptr:*mut u8,len:usize)->u64 {
    let input=Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr,len));
    let output=match run(&input) { Ok(value)=>serde_json::json!({"ok":value}), Err(error)=>serde_json::json!({"error":error}) }.to_string().into_bytes().into_boxed_slice();
    let len=output.len() as u64;let ptr=Box::into_raw(output) as *mut u8 as u64;
    (ptr<<32)|len
}
/// Free only a returned result buffer, using its original length.
#[no_mangle]
pub unsafe extern "C" fn release(ptr:*mut u8,len:usize) { drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr,len))); }
