//! SQL Query builder and dashboard visualization with multiple chart types.

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

/// Chart visualization type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ChartType {
    /// Line chart for time-series data
    Line,
    /// Bar chart for categorical comparisons
    Bar,
    /// Pie chart for proportions
    Pie,
    /// Table view with raw data
    Table,
    /// KPI card displaying a single metric
    KpiCard,
}

/// SQL query configuration for dashboard visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SqlQuery {
    /// Unique identifier for the query
    pub id: String,

    /// Human-readable name for the query (e.g., "Monthly Revenue")
    pub name: String,

    /// SQL query string (e.g., "SELECT * FROM orders WHERE date > NOW() - INTERVAL 30 DAY")
    pub query: String,

    /// Chart visualization type
    pub viz_type: ChartType,
}

impl SqlQuery {
    /// Creates a new SQL query
    pub fn new(name: String, query: String, viz_type: ChartType) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            query,
            viz_type,
        }
    }

    /// Validates query (basic SQL check)
    pub fn is_valid(&self) -> bool {
        !self.query.trim().is_empty() && !self.name.trim().is_empty()
    }
}

/// Dashboard query storage
pub struct SqlDashboard {
    queries: Arc<DashMap<String, SqlQuery>>,
}

impl SqlDashboard {
    /// Creates a new SQL dashboard
    pub fn new() -> Self {
        Self {
            queries: Arc::new(DashMap::new()),
        }
    }

    /// Adds a query to the dashboard
    pub fn add_query(&self, query: SqlQuery) -> Result<String, String> {
        if !query.is_valid() {
            return Err("Query name and SQL cannot be empty".to_string());
        }
        let query_id = query.id.clone();
        self.queries.insert(query_id.clone(), query);
        Ok(query_id)
    }

    /// Retrieves a query by ID
    pub fn get_query(&self, id: &str) -> Option<SqlQuery> {
        self.queries.get(id).map(|ref_multi| ref_multi.clone())
    }

    /// Lists all queries
    pub fn list_queries(&self) -> Vec<SqlQuery> {
        self.queries
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }
}

impl Default for SqlDashboard {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sql_query_creation() {
        let query = SqlQuery::new(
            "Monthly Revenue".to_string(),
            "SELECT SUM(amount) FROM orders".to_string(),
            ChartType::Line,
        );
        assert_eq!(query.name, "Monthly Revenue");
        assert!(query.is_valid());
    }

    #[test]
    fn test_sql_dashboard_add_query() {
        let dashboard = SqlDashboard::new();
        let query = SqlQuery::new(
            "User Count".to_string(),
            "SELECT COUNT(*) FROM users".to_string(),
            ChartType::KpiCard,
        );
        let result = dashboard.add_query(query);
        assert!(result.is_ok());
    }

    #[test]
    fn test_chart_type_variants() {
        assert_eq!(ChartType::Line, ChartType::Line);
        assert_ne!(ChartType::Bar, ChartType::Pie);
    }
}
