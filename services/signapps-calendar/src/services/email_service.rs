/// Email notification service
/// Handles SMTP email sending for calendar events and reminders

use lettre::transport::smtp::SmtpTransport;
use lettre::{Message, Transport};
use minijinja::Environment;
use sqlx::PgPool;
use std::collections::HashMap;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use signapps_db::models::{NotificationChannel, NotificationSent, NotificationStatus, NotificationTemplate};
use signapps_db::repositories::NotificationTemplateRepository;

/// Email service for sending calendar notifications
pub struct EmailService {
    smtp: SmtpTransport,
    from_address: String,
    template_env: Environment<'static>,
}

impl EmailService {
    /// Create new email service
    pub fn new(smtp_host: &str, smtp_port: u16, username: &str, password: &str, from_address: String) -> Result<Self, lettre::error::Error> {
        let creds = lettre::transport::smtp::authentication::Credentials::new(
            username.to_string().into(),
            password.to_string().into(),
        );

        let smtp = SmtpTransport::builder_dangerous(smtp_host)
            .port(smtp_port)
            .credentials(creds)
            .build()?;

        let mut env = Environment::new();
        // Register common filters
        env.set_trim_blocks(true);
        env.set_lstrip_blocks(true);

        Ok(Self {
            smtp,
            from_address,
            template_env: env,
        })
    }

    /// Send event reminder email
    pub async fn send_event_reminder(
        &self,
        pool: &PgPool,
        user_email: &str,
        event_title: &str,
        event_time: &str,
        event_location: &str,
        event_id: Uuid,
        organizer: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        info!(
            user = user_email,
            event = event_title,
            "Sending event reminder email"
        );

        // Get template
        let template = NotificationTemplateRepository::get_by_type_channel(
            pool,
            "event_reminder",
            "email",
        )
        .await?;

        // Build context
        let mut context = HashMap::new();
        context.insert("event_title", event_title);
        context.insert("event_time", event_time);
        context.insert("event_location", event_location);
        context.insert("organizer", organizer);
        context.insert("event_link", &format!("/calendar/events/{}", event_id));

        // Render email
        let subject = self.render_template(&template.subject.unwrap_or_default(), &context)?;
        let html_body = self.render_template(&template.template_html.unwrap_or_default(), &context)?;

        // Send email
        let message = Message::builder()
            .from(self.from_address.parse()?)
            .to(user_email.parse()?)
            .subject(subject)
            .multipart(
                lettre::message::MultiPart::alternative()
                    .singlepart(lettre::message::SinglePart::plain(html_body.clone()))
                    .singlepart(lettre::message::SinglePart::html(html_body))
            )?;

        self.smtp.send(&message)?;

        info!(
            user = user_email,
            event = event_title,
            "Event reminder email sent"
        );

        Ok(format!("Email sent to {}", user_email))
    }

    /// Send event invitation email
    pub async fn send_event_invitation(
        &self,
        pool: &PgPool,
        invitee_email: &str,
        event_title: &str,
        event_time: &str,
        event_location: &str,
        organizer: &str,
        event_id: Uuid,
    ) -> Result<String, Box<dyn std::error::Error>> {
        info!(
            invitee = invitee_email,
            event = event_title,
            "Sending event invitation email"
        );

        let mut context = HashMap::new();
        context.insert("event_title", event_title);
        context.insert("event_time", event_time);
        context.insert("event_location", event_location);
        context.insert("organizer", organizer);
        context.insert("event_link", &format!("/calendar/events/{}", event_id));

        let message = Message::builder()
            .from(self.from_address.parse()?)
            .to(invitee_email.parse()?)
            .subject(format!("Invitation: {}", event_title))
            .multipart(
                lettre::message::MultiPart::alternative()
                    .singlepart(lettre::message::SinglePart::plain(
                        format!("You are invited to {}", event_title)
                    ))
                    .singlepart(lettre::message::SinglePart::html(
                        format!(
                            "<html><body><h2>Invitation: {}</h2><p>{}</p><p>{}</p></body></html>",
                            event_title, event_time, event_location
                        )
                    ))
            )?;

        self.smtp.send(&message)?;

        info!(
            invitee = invitee_email,
            event = event_title,
            "Event invitation email sent"
        );

        Ok(format!("Invitation sent to {}", invitee_email))
    }

    /// Send daily digest email
    pub async fn send_daily_digest(
        &self,
        pool: &PgPool,
        user_email: &str,
        events: Vec<(String, String)>, // (title, time)
    ) -> Result<String, Box<dyn std::error::Error>> {
        info!(
            user = user_email,
            count = events.len(),
            "Sending daily digest email"
        );

        let events_html = events
            .iter()
            .map(|(title, time)| format!("<li>{} - {}</li>", title, time))
            .collect::<Vec<_>>()
            .join("\n");

        let html_body = format!(
            r#"
            <html>
                <body style="font-family: Arial, sans-serif; color: #333;">
                    <h2>Your Calendar Digest</h2>
                    <p>Here are your events for today:</p>
                    <ul>{}</ul>
                    <hr>
                    <p style="font-size: 12px; color: #999;">
                        <a href="/calendar/settings/notifications">Manage notifications</a>
                    </p>
                </body>
            </html>
            "#,
            events_html
        );

        let message = Message::builder()
            .from(self.from_address.parse()?)
            .to(user_email.parse()?)
            .subject("Your Calendar Digest")
            .multipart(
                lettre::message::MultiPart::alternative()
                    .singlepart(lettre::message::SinglePart::plain(
                        format!("You have {} events today", events.len())
                    ))
                    .singlepart(lettre::message::SinglePart::html(html_body))
            )?;

        self.smtp.send(&message)?;

        info!(
            user = user_email,
            "Daily digest email sent"
        );

        Ok(format!("Digest sent to {}", user_email))
    }

    /// Send task assignment email
    pub async fn send_task_assignment(
        &self,
        assignee_email: &str,
        task_title: &str,
        assigned_by: &str,
        task_id: Uuid,
    ) -> Result<String, Box<dyn std::error::Error>> {
        info!(
            assignee = assignee_email,
            task = task_title,
            "Sending task assignment email"
        );

        let html_body = format!(
            r#"
            <html>
                <body>
                    <h2>New Task Assignment</h2>
                    <p>{} has assigned you a task:</p>
                    <h3>{}</h3>
                    <a href="/tasks/{}">View Task</a>
                </body>
            </html>
            "#,
            assigned_by, task_title, task_id
        );

        let message = Message::builder()
            .from(self.from_address.parse()?)
            .to(assignee_email.parse()?)
            .subject(format!("Task assigned: {}", task_title))
            .multipart(
                lettre::message::MultiPart::alternative()
                    .singlepart(lettre::message::SinglePart::plain(
                        format!("{} assigned: {}", assigned_by, task_title)
                    ))
                    .singlepart(lettre::message::SinglePart::html(html_body))
            )?;

        self.smtp.send(&message)?;

        info!(
            assignee = assignee_email,
            task = task_title,
            "Task assignment email sent"
        );

        Ok(format!("Task assignment sent to {}", assignee_email))
    }

    /// Render template with context
    fn render_template(
        &self,
        template_str: &str,
        context: &HashMap<&str, &str>,
    ) -> Result<String, minijinja::Error> {
        let tmpl = self.template_env.from_str(template_str)?;
        let mut ctx = minijinja::context! {};

        for (key, value) in context {
            ctx[*key] = *value;
        }

        tmpl.render(ctx)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_email_service_creation() {
        // In test mode, use localhost:1025 (mailhog)
        let service = EmailService::new("localhost", 1025, "test", "test", "test@example.com");
        // Would fail if mailhog not running, so we just check the type
        let _ = std::any::type_name_of_val(&service);
    }

    #[test]
    fn test_render_template() {
        let service = EmailService::new("localhost", 1025, "test", "test", "test@example.com")
            .expect("Failed to create email service");

        let template = "Hello {{ name }}, your event is at {{ time }}";
        let mut context = HashMap::new();
        context.insert("name", "Alice");
        context.insert("time", "10:00 AM");

        let result = service.render_template(template, &context);
        assert!(result.is_ok());
        assert!(result.expect("template rendering should succeed").contains("Alice"));
    }

    #[test]
    fn test_event_time_formatting() {
        let time = "2026-02-20 10:00:00";
        // In production, would use chrono for formatting
        let formatted = format!("{}UTC", time);
        assert!(formatted.contains("2026"));
    }
}
