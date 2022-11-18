// :TODO: store and filter by tags
// :TODO: read location of server.db file from environment or config
// :TODO: support TLS if certficates are available
// :TODO: request optional TLS client certificates
#[macro_use] extern crate rocket;
use rocket::fs::relative;
use rocket::serde::{Serialize, Deserialize, json::Json};
use rocket_db_pools::{self, sqlx::{self, Row}, Database, Connection};

use ripple::rocketutil::FileExtServer;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}

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

#[derive(rocket_db_pools::Database)]
#[database("serverdb")]
struct ServerDB(sqlx::SqlitePool);

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

fn create_server() -> rocket::Rocket<rocket::Build> {
    rocket::custom(rocket::Config::figment()
                   .merge(("address", "0.0.0.0"))
                   .merge(("port", 7878))
                   .merge(("databases.serverdb.url",
                           "./server.db")))
        .attach(ServerDB::init())
        .attach(rocket::fairing::AdHoc::try_on_ignite(
            "SQL Initialization", sql_init))
        .mount("/", FileExtServer::new(relative!("index.html")))
        .mount("/favicon.ico", FileExtServer::new(
            relative!("resources/images/ripple.png")).rank(1))
        .mount("/apps", FileExtServer::new(relative!("apps")))
        .mount("/slides", FileExtServer::new(relative!("slides")))
        .mount("/expense", FileExtServer::new(
            relative!("apps/expense.html")))
        .mount("/expense", routes![expense_add, expense_list])
}

#[rocket::main]
async fn main() -> Result<(), rocket::Error>
{ let _rocket = create_server().launch().await?; Ok(()) }
