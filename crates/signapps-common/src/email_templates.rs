use std::collections::HashMap;

/// Simple Handlebars-like template engine for email notifications.
/// Supports `{{variable}}` substitution.
pub struct EmailTemplate {
    subject: String,
    html_body: String,
    text_body: String,
}

impl EmailTemplate {
    /// Create a new template from raw subject, HTML body, and plain-text body strings.
    pub fn new(subject: &str, html_body: &str, text_body: &str) -> Self {
        Self {
            subject: subject.to_string(),
            html_body: html_body.to_string(),
            text_body: text_body.to_string(),
        }
    }

    /// Render the template by substituting all `{{key}}` placeholders with values from `vars`.
    pub fn render(&self, vars: &HashMap<String, String>) -> RenderedEmail {
        RenderedEmail {
            subject: self.substitute(&self.subject, vars),
            html_body: self.substitute(&self.html_body, vars),
            text_body: self.substitute(&self.text_body, vars),
        }
    }

    fn substitute(&self, template: &str, vars: &HashMap<String, String>) -> String {
        let mut result = template.to_string();
        for (key, value) in vars {
            result = result.replace(&format!("{{{{{}}}}}", key), value);
        }
        result
    }
}

/// Represents a rendered email with all variables substituted.
pub struct RenderedEmail {
    /// The fully rendered email subject line.
    pub subject: String,
    /// The fully rendered HTML body of the email.
    pub html_body: String,
    /// The fully rendered plain-text body of the email.
    pub text_body: String,
}

/// Pre-built templates
pub fn signature_request_template() -> EmailTemplate {
    EmailTemplate::new(
        "{{sender_name}} vous demande de signer un document",
        r#"<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2>Demande de signature</h2>
            <p><strong>{{sender_name}}</strong> vous a envoyé le document <em>{{document_title}}</em> à signer.</p>
            <p><a href="{{sign_url}}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:6px">Signer le document</a></p>
            <p style="color:#666;font-size:12px">Ce lien expire le {{expires_at}}</p>
        </div>"#,
        "{{sender_name}} vous a envoyé {{document_title}} à signer.\nSignez ici: {{sign_url}}\nExpire le {{expires_at}}",
    )
}

/// Generic notification email template for platform alerts and in-app messages.
pub fn notification_template() -> EmailTemplate {
    EmailTemplate::new(
        "[SignApps] {{title}}",
        r#"<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h3>{{title}}</h3>
            <p>{{body}}</p>
            <p style="color:#666;font-size:12px">{{source}} — {{timestamp}}</p>
        </div>"#,
        "{{title}}\n\n{{body}}\n\n{{source}} — {{timestamp}}",
    )
}

/// Welcome email template sent to new users after account creation.
pub fn welcome_template() -> EmailTemplate {
    EmailTemplate::new(
        "Bienvenue sur SignApps, {{user_name}}!",
        r#"<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2>Bienvenue, {{user_name}}!</h2>
            <p>Votre compte est configuré. Connectez-vous à <a href="{{login_url}}">{{login_url}}</a></p>
        </div>"#,
        "Bienvenue {{user_name}}!\nConnectez-vous: {{login_url}}",
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_template_substitution() {
        let tpl = signature_request_template();
        let mut vars = HashMap::new();
        vars.insert("sender_name".into(), "Alice".into());
        vars.insert("document_title".into(), "Contrat.pdf".into());
        vars.insert("sign_url".into(), "https://app.local/sign/abc".into());
        vars.insert("expires_at".into(), "2026-04-01".into());
        let rendered = tpl.render(&vars);
        assert!(rendered.subject.contains("Alice"));
        assert!(rendered.html_body.contains("Contrat.pdf"));
        assert!(rendered.text_body.contains("https://app.local/sign/abc"));
    }
}
