//! Prometheus metrics exporter.

use crate::metrics::collector::MetricsCollector;
use prometheus::{Encoder, GaugeVec, IntGaugeVec, Opts, Registry, TextEncoder};

/// Prometheus metrics exporter.
pub struct PrometheusExporter {
    registry: Registry,
    collector: MetricsCollector,

    // CPU metrics
    cpu_usage: GaugeVec,
    cpu_count: prometheus::IntGauge,
    load_avg_1: prometheus::Gauge,
    load_avg_5: prometheus::Gauge,
    load_avg_15: prometheus::Gauge,

    // Memory metrics
    memory_total: prometheus::IntGauge,
    memory_used: prometheus::IntGauge,
    memory_available: prometheus::IntGauge,
    swap_total: prometheus::IntGauge,
    swap_used: prometheus::IntGauge,

    // Disk metrics
    disk_total: IntGaugeVec,
    disk_used: IntGaugeVec,
    disk_available: IntGaugeVec,

    // Network metrics
    network_rx_bytes: IntGaugeVec,
    network_tx_bytes: IntGaugeVec,

    // System metrics
    uptime_seconds: prometheus::IntGauge,
}

impl PrometheusExporter {
    /// Create a new Prometheus exporter.
    pub fn new(collector: MetricsCollector) -> Self {
        let registry = Registry::new();

        // CPU metrics
        let cpu_usage = GaugeVec::new(
            Opts::new(
                "signapps_cpu_usage_percent",
                "CPU usage percentage per core",
            ),
            &["cpu"],
        )
        .unwrap();

        let cpu_count =
            prometheus::IntGauge::new("signapps_cpu_count", "Number of CPU cores").unwrap();

        let load_avg_1 =
            prometheus::Gauge::new("signapps_load_average_1m", "1 minute load average").unwrap();

        let load_avg_5 =
            prometheus::Gauge::new("signapps_load_average_5m", "5 minute load average").unwrap();

        let load_avg_15 =
            prometheus::Gauge::new("signapps_load_average_15m", "15 minute load average").unwrap();

        // Memory metrics
        let memory_total =
            prometheus::IntGauge::new("signapps_memory_total_bytes", "Total memory in bytes")
                .unwrap();

        let memory_used =
            prometheus::IntGauge::new("signapps_memory_used_bytes", "Used memory in bytes")
                .unwrap();

        let memory_available = prometheus::IntGauge::new(
            "signapps_memory_available_bytes",
            "Available memory in bytes",
        )
        .unwrap();

        let swap_total =
            prometheus::IntGauge::new("signapps_swap_total_bytes", "Total swap in bytes").unwrap();

        let swap_used =
            prometheus::IntGauge::new("signapps_swap_used_bytes", "Used swap in bytes").unwrap();

        // Disk metrics
        let disk_total = IntGaugeVec::new(
            Opts::new("signapps_disk_total_bytes", "Total disk space in bytes"),
            &["device", "mount"],
        )
        .unwrap();

        let disk_used = IntGaugeVec::new(
            Opts::new("signapps_disk_used_bytes", "Used disk space in bytes"),
            &["device", "mount"],
        )
        .unwrap();

        let disk_available = IntGaugeVec::new(
            Opts::new(
                "signapps_disk_available_bytes",
                "Available disk space in bytes",
            ),
            &["device", "mount"],
        )
        .unwrap();

        // Network metrics
        let network_rx_bytes = IntGaugeVec::new(
            Opts::new(
                "signapps_network_receive_bytes_total",
                "Total bytes received",
            ),
            &["interface"],
        )
        .unwrap();

        let network_tx_bytes = IntGaugeVec::new(
            Opts::new(
                "signapps_network_transmit_bytes_total",
                "Total bytes transmitted",
            ),
            &["interface"],
        )
        .unwrap();

        // System metrics
        let uptime_seconds =
            prometheus::IntGauge::new("signapps_uptime_seconds", "System uptime in seconds")
                .unwrap();

        // Register all metrics
        registry.register(Box::new(cpu_usage.clone())).unwrap();
        registry.register(Box::new(cpu_count.clone())).unwrap();
        registry.register(Box::new(load_avg_1.clone())).unwrap();
        registry.register(Box::new(load_avg_5.clone())).unwrap();
        registry.register(Box::new(load_avg_15.clone())).unwrap();
        registry.register(Box::new(memory_total.clone())).unwrap();
        registry.register(Box::new(memory_used.clone())).unwrap();
        registry
            .register(Box::new(memory_available.clone()))
            .unwrap();
        registry.register(Box::new(swap_total.clone())).unwrap();
        registry.register(Box::new(swap_used.clone())).unwrap();
        registry.register(Box::new(disk_total.clone())).unwrap();
        registry.register(Box::new(disk_used.clone())).unwrap();
        registry.register(Box::new(disk_available.clone())).unwrap();
        registry
            .register(Box::new(network_rx_bytes.clone()))
            .unwrap();
        registry
            .register(Box::new(network_tx_bytes.clone()))
            .unwrap();
        registry.register(Box::new(uptime_seconds.clone())).unwrap();

        Self {
            registry,
            collector,
            cpu_usage,
            cpu_count,
            load_avg_1,
            load_avg_5,
            load_avg_15,
            memory_total,
            memory_used,
            memory_available,
            swap_total,
            swap_used,
            disk_total,
            disk_used,
            disk_available,
            network_rx_bytes,
            network_tx_bytes,
            uptime_seconds,
        }
    }

    /// Update all metrics from collector.
    pub async fn update(&self) {
        let metrics = self.collector.get_all_metrics().await;

        // Update CPU metrics
        self.cpu_count.set(metrics.cpu.count as i64);
        self.load_avg_1.set(metrics.cpu.load_average.one);
        self.load_avg_5.set(metrics.cpu.load_average.five);
        self.load_avg_15.set(metrics.cpu.load_average.fifteen);

        for (i, usage) in metrics.cpu.usage_per_cpu.iter().enumerate() {
            self.cpu_usage
                .with_label_values(&[&format!("cpu{}", i)])
                .set(*usage as f64);
        }

        // Update memory metrics
        self.memory_total.set(metrics.memory.total_bytes as i64);
        self.memory_used.set(metrics.memory.used_bytes as i64);
        self.memory_available
            .set(metrics.memory.available_bytes as i64);
        self.swap_total.set(metrics.memory.swap_total_bytes as i64);
        self.swap_used.set(metrics.memory.swap_used_bytes as i64);

        // Update disk metrics
        for disk in &metrics.disks {
            self.disk_total
                .with_label_values(&[&disk.name, &disk.mount_point])
                .set(disk.total_bytes as i64);
            self.disk_used
                .with_label_values(&[&disk.name, &disk.mount_point])
                .set(disk.used_bytes as i64);
            self.disk_available
                .with_label_values(&[&disk.name, &disk.mount_point])
                .set(disk.available_bytes as i64);
        }

        // Update network metrics
        for net in &metrics.networks {
            self.network_rx_bytes
                .with_label_values(&[&net.name])
                .set(net.received_bytes as i64);
            self.network_tx_bytes
                .with_label_values(&[&net.name])
                .set(net.transmitted_bytes as i64);
        }

        // Update system metrics
        self.uptime_seconds.set(metrics.uptime_seconds as i64);
    }

    /// Export metrics in Prometheus text format.
    pub fn export(&self) -> String {
        let encoder = TextEncoder::new();
        let metric_families = self.registry.gather();
        let mut buffer = Vec::new();
        encoder.encode(&metric_families, &mut buffer).unwrap();
        String::from_utf8(buffer).unwrap()
    }
}
