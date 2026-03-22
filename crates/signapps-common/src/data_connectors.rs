//! Multi-source data connector system for database integration and file uploads.

use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

/// Data source type for connectors
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum SourceType {
    /// PostgreSQL database connection
    PostgreSQL,
    /// CSV file upload
    CsvUpload,
    /// External JSON API
    JsonApi,
}

/// Data source configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DataSource {
    /// Unique identifier for the data source
    pub id: String,

    /// Display name (e.g., "Production Database", "Customer CSV")
    pub name: String,

    /// Type of data source
    pub source_type: SourceType,
}

impl DataSource {
    /// Creates a new data source
    pub fn new(name: String, source_type: SourceType) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            source_type,
        }
    }

    /// Validates data source configuration
    pub fn is_valid(&self) -> bool {
        !self.name.trim().is_empty()
    }
}

/// Data connector registry for managing multiple sources
pub struct DataConnectors {
    sources: Arc<DashMap<String, DataSource>>,
}

impl DataConnectors {
    /// Creates a new data connectors registry
    pub fn new() -> Self {
        Self {
            sources: Arc::new(DashMap::new()),
        }
    }

    /// Adds a new data source
    pub fn add_source(&self, source: DataSource) -> Result<String, String> {
        if !source.is_valid() {
            return Err("Data source name cannot be empty".to_string());
        }
        let source_id = source.id.clone();
        self.sources.insert(source_id.clone(), source);
        Ok(source_id)
    }

    /// Retrieves a data source by ID
    pub fn get_source(&self, id: &str) -> Option<DataSource> {
        self.sources.get(id).map(|ref_multi| ref_multi.clone())
    }

    /// Lists all data sources
    pub fn list_sources(&self) -> Vec<DataSource> {
        self.sources
            .iter()
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Lists data sources by type
    pub fn list_by_type(&self, source_type: SourceType) -> Vec<DataSource> {
        self.sources
            .iter()
            .filter(|entry| entry.value().source_type == source_type)
            .map(|entry| entry.value().clone())
            .collect()
    }

    /// Removes a data source
    pub fn remove_source(&self, id: &str) -> Result<(), String> {
        self.sources
            .remove(id)
            .ok_or_else(|| format!("Data source {} not found", id))
            .map(|_| ())
    }
}

impl Default for DataConnectors {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_data_source_creation() {
        let source = DataSource::new("My Database".to_string(), SourceType::PostgreSQL);
        assert_eq!(source.name, "My Database");
        assert_eq!(source.source_type, SourceType::PostgreSQL);
        assert!(source.is_valid());
    }

    #[test]
    fn test_data_connectors_add_source() {
        let connectors = DataConnectors::new();
        let source = DataSource::new(
            "CSV Import".to_string(),
            SourceType::CsvUpload,
        );
        let result = connectors.add_source(source);
        assert!(result.is_ok());
    }

    #[test]
    fn test_data_connectors_list_by_type() {
        let connectors = DataConnectors::new();
        connectors.add_source(DataSource::new(
            "DB 1".to_string(),
            SourceType::PostgreSQL,
        )).ok();
        connectors.add_source(DataSource::new(
            "CSV 1".to_string(),
            SourceType::CsvUpload,
        )).ok();

        let pg_sources = connectors.list_by_type(SourceType::PostgreSQL);
        assert_eq!(pg_sources.len(), 1);
    }
}
