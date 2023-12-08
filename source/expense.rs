use std::fs::File;
use std::io::Read;
use axum;
use sqlx::{self, Row};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct Expense {
    id:     i32,
    amount: f32,
    reason: String,
    date:   String,
    tags:   Vec<String>
}

#[derive(Serialize, Deserialize)]
pub struct ExpenseList {
    expenses: Vec<Expense>
}

async fn page() -> impl axum::response::IntoResponse
{
    match File::open("./apps/expense.html") {
        Ok(mut file) => {
            let mut contents = String::new();
            match file.read_to_string(&mut contents) {
                Ok(_) => {
                    axum::response::Response::builder()
                        .status(axum::http::StatusCode::OK)
                        .body(axum::body::Body::from(contents))
                        .unwrap()
                },
                Err(err) => {
                    axum::response::Response::builder()
                        .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
                        .body(axum::body::Body::from(err.to_string()))
                        .unwrap()
                }
            }            
        },
        Err(err) => {
            axum::response::Response::builder()
                .status(axum::http::StatusCode::NOT_FOUND)
                .body(axum::body::Body::from(err.to_string()))
                .unwrap()
        }
    }
}

async fn list(axum::extract::Extension(pool):
                  axum::extract::Extension<sqlx::SqlitePool>
) -> Result<axum::Json<ExpenseList>, String>
{
    let mut list = ExpenseList { expenses: Vec::new() };
    match sqlx::query(r#"
        SELECT id, amount, reason, date
          FROM expenses ORDER BY date;"#)
        .fetch_all(&pool).await {
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
                Ok(axum::Json(list))
            },
            Err(e) => { Err(e.to_string()) }
        }
}

async fn add(axum::extract::Extension(pool):
             axum::extract::Extension<sqlx::SqlitePool>,
             expense: axum::Json<Expense>) ->
      impl axum::response::IntoResponse
{
    match sqlx::query(r#"
        INSERT INTO expenses (reason, amount, date)
        VALUES ($1, $2, $3);"#)
        .bind(&expense.reason)
        .bind(expense.amount)
        .bind(&expense.date)
        .execute(&pool).await {
            Ok(_) => axum::response::Response::builder()
                .status(axum::http::StatusCode::CREATED)
                .body(axum::body::Body::from("Expense created"))
                .unwrap(),
            Err(err) => axum::response::Response::builder()
                .status(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
                .body(axum::body::Body::from(err.to_string()))
                .unwrap()
        }
}


pub async fn setup(app: axum::Router) -> axum::Router {
    let pool = sqlx::Pool::<sqlx::Sqlite>::connect_with(
        sqlx::sqlite::SqliteConnectOptions::new()
            .create_if_missing(true)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
            .filename(&"expense.db"), )
        .await.expect("Failed to create pool");
    sqlx::query(r#"
        CREATE TABLE IF NOT EXISTS expenses (
               id INTEGER PRIMARY KEY,
               reason TEXT NOT NULL,
               amount REAL NOT NULL,
               date TIMESTAMP DEFAULT CURRENT_TIMESTAMP);"#, )
        .execute(&pool)
        .await.expect("Failed to create table");
    app
        .route("/expense", axum::routing::get(page))
        .route("/expense/", axum::routing::get(page))
        .route("/expense/index", axum::routing::get(page))
        .route("/expense/index.html", axum::routing::get(page))
        .route("/expense/list", axum::routing::get(list))
        .route("/expense/add", axum::routing::post(add))
        .layer(axum::extract::Extension(pool))
}
