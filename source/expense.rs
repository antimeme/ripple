use rocket::fs::relative;
use rocket::serde::{Serialize, Deserialize, json::Json};
use rocket_db_pools::{self, sqlx::{self, Row}, Database, Connection};
use crate::rocketutil::FileExtServer;

#[derive(rocket_db_pools::Database)]
#[database("serverdb")]
struct ServerDB(sqlx::SqlitePool);

async fn sql_init(
    rocket: rocket::Rocket<rocket::Build>
) -> rocket::fairing::Result {
    match ServerDB::fetch(&rocket) {
        Some(pool) => {
            match pool.acquire().await {
                Ok(mut db) =>
                    match sqlx::query(r#"
                CREATE TABLE IF NOT EXISTS expenses (
                    id INTEGER PRIMARY KEY,
                    reason TEXT NOT NULL,
                    amount REAL NOT NULL,
                    date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );"#).execute(&mut db).await {
                    Ok(_) => Ok(rocket),
                    Err(err) => {
                        error!("Failed to initialize SQL database: {}",
                               err.to_string());
                        Err(rocket)
                    }
                },
                Err(err) => {
                    error!("Failed to get SQL connection: {}",
                           err.to_string());
                    Err(rocket)
                }
            }
        },
        None => Err(rocket)
    }
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
struct Expense {
    id:     i32,
    amount: f32,
    reason: String,
    date:   String,
    tags:   Vec<String>
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
struct ExpenseList {
    expenses: Vec<Expense>
}

#[get("/list", format="json")]
async fn expense_list(
    mut db: Connection<ServerDB>
) -> Result<Json<ExpenseList>, String>
{
    let mut list = ExpenseList { expenses: Vec::new() };
    match sqlx::query(concat!(
        "SELECT id, amount, reason, date ",
        "  FROM expenses",
        " ORDER BY date;"))
        .fetch_all(&mut *db).await {
            Ok(cursor) => {
                for row in cursor {
                    list.expenses.push(Expense {
                        id:     row.get(0),
                        amount: row.get(1),
                        reason: row.get(2),
                        date:   row.get(3),
                        tags:   Vec::new()
                    });
                }
                Ok(Json(list))
            },
            Err(e) => { Err(e.to_string()) }
        }
}

#[post("/add", format="json", data="<expense>")]
async fn expense_add(
    mut db: Connection<ServerDB>,
    expense: Json<Expense>
) -> String
{
    println!("Date: {}", &expense.date);
    match sqlx::query(concat!(
        "INSERT INTO expenses (reason, amount, date) ",
        "VALUES ($1, $2, $3);"))
        .bind(&expense.reason)
        .bind(expense.amount)
        .bind(&expense.date)
        .execute(&mut *db).await {
            Ok(_) => "Success".to_string(),
            Err(err) => err.to_string()
        }
}

pub fn expense_server(
    rkt: rocket::Rocket<rocket::Build>
) -> rocket::Rocket<rocket::Build> {
    rkt
        .attach(ServerDB::init())
        .attach(rocket::fairing::AdHoc::try_on_ignite(
            "SQL Initialization", sql_init))
        .mount("/expense", FileExtServer::new(
            relative!("apps/expense.html")))
        .mount("/expense", routes![expense_add, expense_list])
}
