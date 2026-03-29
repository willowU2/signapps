#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# seed-demo-data.sh — Populate SignApps with realistic demo data
# ──────────────────────────────────────────────────────────────────────────────
# Usage:
#   ./scripts/seed-demo-data.sh              # uses defaults
#   ./scripts/seed-demo-data.sh --force      # re-create even if data exists
#   ./scripts/seed-demo-data.sh --dry-run    # show what would be created
#
# Prerequisites: services must be running (at least identity, calendar, scheduler, storage)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# ── Configuration ────────────────────────────────────────────────────────────
IDENTITY_URL="${IDENTITY_URL:-http://localhost:3001/api/v1}"
CALENDAR_URL="${CALENDAR_URL:-http://localhost:3011/api/v1}"
SCHEDULER_URL="${SCHEDULER_URL:-http://localhost:3007/api/v1}"
STORAGE_URL="${STORAGE_URL:-http://localhost:3004/api/v1}"

ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin}"
FORCE=false
DRY_RUN=false

# ── Parse arguments ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --force)    FORCE=true; shift ;;
        --dry-run)  DRY_RUN=true; shift ;;
        -h|--help)
            echo "Usage: $0 [--force] [--dry-run]"
            echo "  --force    Re-create data even if it already exists"
            echo "  --dry-run  Show what would be created without making changes"
            exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'; GRAY='\033[0;90m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}[OK]${NC}   $1"; }
skip() { echo -e "  ${YELLOW}[SKIP]${NC} $1"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; }
info() { echo -e "  ${CYAN}[..]${NC}   $1"; }
dry()  { echo -e "  ${MAGENTA}[DRY]${NC}  $1"; }

# ── Helpers ──────────────────────────────────────────────────────────────────

# Authenticated curl wrapper — uses cookie jar for session auth
COOKIE_JAR=$(mktemp)
trap "rm -f $COOKIE_JAR" EXIT

api_post() {
    local url="$1"
    local data="$2"
    curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
        -H "Content-Type: application/json" \
        -X POST "$url" -d "$data" 2>/dev/null
}

api_get() {
    local url="$1"
    curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
        -H "Content-Type: application/json" \
        "$url" 2>/dev/null
}

api_put() {
    local url="$1"
    local data="$2"
    curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
        -H "Content-Type: application/json" \
        -X PUT "$url" -d "$data" 2>/dev/null
}

check_port() {
    (echo >/dev/tcp/127.0.0.1/"$1") 2>/dev/null
}

# ── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${MAGENTA}╔══════════════════════════════════════════╗${NC}"
echo -e "  ${MAGENTA}║    SignApps — Demo Data Seeder           ║${NC}"
echo -e "  ${MAGENTA}╚══════════════════════════════════════════╝${NC}"
echo ""

if $DRY_RUN; then
    echo -e "  ${YELLOW}Running in dry-run mode (no changes will be made)${NC}"
    echo ""
fi

# ── Step 1: Check services ──────────────────────────────────────────────────
echo -e "  ${CYAN}Checking services...${NC}"

IDENTITY_OK=false
CALENDAR_OK=false
SCHEDULER_OK=false
STORAGE_OK=false

if check_port 3001; then IDENTITY_OK=true; ok "Identity (port 3001)"; else fail "Identity (port 3001) — not running"; fi
if check_port 3011; then CALENDAR_OK=true; ok "Calendar (port 3011)"; else skip "Calendar (port 3011) — not running"; fi
if check_port 3007; then SCHEDULER_OK=true; ok "Scheduler (port 3007)"; else skip "Scheduler (port 3007) — not running"; fi
if check_port 3004; then STORAGE_OK=true; ok "Storage (port 3004)"; else skip "Storage (port 3004) — not running"; fi
echo ""

if ! $IDENTITY_OK; then
    fail "Identity service is required. Start it first: cargo run -p signapps-identity"
    exit 1
fi

# ── Step 2: Authenticate as admin ────────────────────────────────────────────
echo -e "  ${CYAN}Authenticating as admin...${NC}"

if $DRY_RUN; then
    dry "Would authenticate as $ADMIN_USER"
else
    LOGIN_RESP=$(api_post "$IDENTITY_URL/auth/login" "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")

    if echo "$LOGIN_RESP" | grep -q "access_token\|user"; then
        ok "Authenticated as $ADMIN_USER"
    else
        fail "Could not authenticate as $ADMIN_USER. Response: $LOGIN_RESP"
        echo ""
        echo -e "  ${YELLOW}Hint: Make sure the admin user exists with password '$ADMIN_PASS'${NC}"
        exit 1
    fi
fi
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# IDENTITY — Demo Users
# ══════════════════════════════════════════════════════════════════════════════
echo -e "  ${CYAN}Creating demo users...${NC}"

create_user() {
    local username="$1"
    local email="$2"
    local display_name="$3"
    local role="$4"
    local password="$5"

    if $DRY_RUN; then
        dry "Would create user: $username ($email) role=$role"
        return
    fi

    # Check if user already exists by listing users and grepping
    EXISTING=$(api_get "$IDENTITY_URL/users" | grep -o "\"username\":\"$username\"" || true)

    if [[ -n "$EXISTING" ]] && ! $FORCE; then
        skip "User '$username' already exists"
        return
    fi

    RESP=$(api_post "$IDENTITY_URL/users" "{
        \"username\": \"$username\",
        \"email\": \"$email\",
        \"display_name\": \"$display_name\",
        \"password\": \"$password\",
        \"role\": $role
    }")

    if echo "$RESP" | grep -q "\"id\""; then
        ok "Created user: $display_name ($username)"
    else
        fail "Failed to create user $username: $RESP"
    fi
}

create_user "marie.dupont" "marie.dupont@signapps.local" "Marie Dupont" 1 "Demo1234!"
create_user "jean.martin"  "jean.martin@signapps.local"  "Jean Martin"  0 "Demo1234!"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# CALENDAR — Demo Events
# ══════════════════════════════════════════════════════════════════════════════
if $CALENDAR_OK; then
    echo -e "  ${CYAN}Creating demo calendar events...${NC}"

    if $DRY_RUN; then
        dry "Would create default calendar + 5 events"
    else
        # Ensure we have a default calendar
        CALENDARS=$(api_get "$CALENDAR_URL/calendars")
        CALENDAR_ID=""

        if echo "$CALENDARS" | grep -q "\"id\""; then
            # Use the first calendar found
            CALENDAR_ID=$(echo "$CALENDARS" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
            info "Using existing calendar: $CALENDAR_ID"
        else
            # Create a default calendar
            CAL_RESP=$(api_post "$CALENDAR_URL/calendars" '{
                "name": "Calendrier principal",
                "description": "Calendrier par defaut de votre organisation",
                "color": "#4285f4",
                "timezone": "Europe/Paris"
            }')
            CALENDAR_ID=$(echo "$CAL_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

            if [[ -n "$CALENDAR_ID" ]]; then
                ok "Created default calendar: $CALENDAR_ID"
            else
                fail "Could not create default calendar: $CAL_RESP"
            fi
        fi

        if [[ -n "$CALENDAR_ID" ]]; then
            # Calculate dates for current week (Mon-Fri)
            # Use portable date arithmetic
            TODAY=$(date +%Y-%m-%d)
            DOW=$(date +%u)  # 1=Monday, 7=Sunday

            # Calculate Monday of this week
            if command -v gdate &>/dev/null; then
                DATE_CMD="gdate"
            else
                DATE_CMD="date"
            fi

            MON_OFFSET=$(( DOW - 1 ))
            MONDAY=$($DATE_CMD -d "$TODAY - $MON_OFFSET days" +%Y-%m-%d 2>/dev/null || $DATE_CMD -v-"${MON_OFFSET}"d +%Y-%m-%d 2>/dev/null || echo "$TODAY")
            TUESDAY=$($DATE_CMD -d "$MONDAY + 1 day" +%Y-%m-%d 2>/dev/null || $DATE_CMD -v+1d -j -f "%Y-%m-%d" "$MONDAY" +%Y-%m-%d 2>/dev/null || echo "$TODAY")
            WEDNESDAY=$($DATE_CMD -d "$MONDAY + 2 days" +%Y-%m-%d 2>/dev/null || $DATE_CMD -v+2d -j -f "%Y-%m-%d" "$MONDAY" +%Y-%m-%d 2>/dev/null || echo "$TODAY")
            THURSDAY=$($DATE_CMD -d "$MONDAY + 3 days" +%Y-%m-%d 2>/dev/null || $DATE_CMD -v+3d -j -f "%Y-%m-%d" "$MONDAY" +%Y-%m-%d 2>/dev/null || echo "$TODAY")
            FRIDAY=$($DATE_CMD -d "$MONDAY + 4 days" +%Y-%m-%d 2>/dev/null || $DATE_CMD -v+4d -j -f "%Y-%m-%d" "$MONDAY" +%Y-%m-%d 2>/dev/null || echo "$TODAY")

            create_event() {
                local title="$1"
                local date="$2"
                local start_hour="$3"
                local end_hour="$4"
                local description="$5"
                local location="${6:-}"
                local color="${7:-#4285f4}"

                # Check if event with this title already exists this week
                EXISTING_EVENTS=$(api_get "$CALENDAR_URL/calendars/$CALENDAR_ID/events?start=${MONDAY}T00:00:00Z&end=${FRIDAY}T23:59:59Z")
                if echo "$EXISTING_EVENTS" | grep -q "\"$title\"" && ! $FORCE; then
                    skip "Event '$title' already exists"
                    return
                fi

                local loc_json=""
                if [[ -n "$location" ]]; then
                    loc_json=", \"location\": \"$location\""
                fi

                RESP=$(api_post "$CALENDAR_URL/calendars/$CALENDAR_ID/events" "{
                    \"title\": \"$title\",
                    \"description\": \"$description\",
                    \"start_time\": \"${date}T${start_hour}:00:00\",
                    \"end_time\": \"${date}T${end_hour}:00:00\",
                    \"timezone\": \"Europe/Paris\",
                    \"color\": \"$color\"
                    $loc_json
                }")

                if echo "$RESP" | grep -q "\"id\""; then
                    ok "Created event: $title ($date $start_hour:00-$end_hour:00)"
                else
                    fail "Failed to create event '$title': $RESP"
                fi
            }

            create_event "Reunion d'equipe" "$MONDAY" "09" "10" \
                "Point hebdomadaire avec toute l'equipe. Ordre du jour: avancement, blocages, prochaines etapes." \
                "Salle Confluence" "#4285f4"

            create_event "Revue de sprint" "$TUESDAY" "14" "15" \
                "Revue des stories livrees ce sprint. Demo des nouvelles fonctionnalites." \
                "Salle de reunion A" "#0b8043"

            create_event "Dejeuner client" "$WEDNESDAY" "12" "14" \
                "Dejeuner de travail avec le client Durand & Associes. Discussion sur le renouvellement du contrat." \
                "Restaurant Le Petit Bistrot" "#f4511e"

            create_event "Formation IA" "$THURSDAY" "10" "12" \
                "Session de formation sur les outils IA integres a SignApps: RAG, assistant, OCR." \
                "Salle Formation" "#8e24aa"

            create_event "Point projet" "$FRIDAY" "16" "17" \
                "Point d'avancement du projet de migration. Revue des risques et du planning." \
                "Bureau CTO" "#f6bf26"
        fi
    fi
    echo ""
fi

# ══════════════════════════════════════════════════════════════════════════════
# SCHEDULER — Demo Cron Jobs
# ══════════════════════════════════════════════════════════════════════════════
if $SCHEDULER_OK; then
    echo -e "  ${CYAN}Creating demo cron jobs...${NC}"

    create_job() {
        local name="$1"
        local cron="$2"
        local command="$3"
        local description="$4"

        if $DRY_RUN; then
            dry "Would create job: $name ($cron)"
            return
        fi

        # Check if job already exists
        EXISTING_JOBS=$(api_get "$SCHEDULER_URL/jobs")
        if echo "$EXISTING_JOBS" | grep -q "\"$name\"" && ! $FORCE; then
            skip "Job '$name' already exists"
            return
        fi

        RESP=$(api_post "$SCHEDULER_URL/jobs" "{
            \"name\": \"$name\",
            \"cron_expression\": \"$cron\",
            \"command\": \"$command\",
            \"description\": \"$description\",
            \"target_type\": \"host\",
            \"enabled\": true
        }")

        if echo "$RESP" | grep -q "\"id\""; then
            ok "Created job: $name ($cron)"
        else
            fail "Failed to create job '$name': $RESP"
        fi
    }

    create_job "Backup quotidien" "0 2 * * *" \
        "pg_dump signapps > /tmp/backup_\$(date +%Y%m%d).sql" \
        "Sauvegarde automatique de la base de donnees chaque nuit a 2h du matin"

    create_job "Nettoyage logs" "0 3 * * 0" \
        "find /var/log/signapps -name '*.log' -mtime +30 -delete" \
        "Suppression des fichiers de log de plus de 30 jours, chaque dimanche a 3h"

    echo ""
fi

# ══════════════════════════════════════════════════════════════════════════════
# STORAGE — Sample Documents
# ══════════════════════════════════════════════════════════════════════════════
if $STORAGE_OK; then
    echo -e "  ${CYAN}Creating sample documents...${NC}"

    if $DRY_RUN; then
        dry "Would upload: Guide de demarrage.md"
        dry "Would upload: Budget exemple.csv"
        dry "Would upload: README-SignApps.md"
    else
        # Ensure default bucket exists
        BUCKETS=$(api_get "$STORAGE_URL/buckets")
        DEFAULT_BUCKET="documents"

        if ! echo "$BUCKETS" | grep -q "\"$DEFAULT_BUCKET\""; then
            BUCKET_RESP=$(api_post "$STORAGE_URL/buckets" "{\"name\":\"$DEFAULT_BUCKET\"}")
            if echo "$BUCKET_RESP" | grep -q "\"name\""; then
                ok "Created bucket: $DEFAULT_BUCKET"
            else
                info "Bucket '$DEFAULT_BUCKET' may already exist"
            fi
        fi

        # Create sample markdown welcome guide
        GUIDE_CONTENT='# Guide de demarrage SignApps

Bienvenue sur SignApps, votre plateforme de productivite 100% locale.

## Premiers pas

1. **Mail** — Configurez votre messagerie dans *Mail > Parametres*
2. **Documents** — Creez des documents collaboratifs dans *Docs*
3. **Calendrier** — Planifiez vos reunions dans *Calendrier*
4. **Stockage** — Gerez vos fichiers dans *Drive*
5. **Chat** — Communiquez avec votre equipe dans *Chat*

## Fonctionnalites avancees

- **IA integree** — Assistant, OCR, transcription vocale
- **Visioconference** — Reunions video avec partage ecran
- **Taches** — Gestion de projet avec tableaux Kanban
- **Formulaires** — Creez des sondages et questionnaires

## Support

Consultez la documentation complete ou contactez votre administrateur.

---
*Genere automatiquement par le systeme de demo SignApps*'

        # Upload guide as file
        TMPFILE=$(mktemp --suffix=.md 2>/dev/null || mktemp)
        echo "$GUIDE_CONTENT" > "$TMPFILE"

        UPLOAD_RESP=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
            -F "file=@${TMPFILE};filename=Guide de demarrage.md;type=text/markdown" \
            "$STORAGE_URL/files/$DEFAULT_BUCKET" 2>/dev/null)
        rm -f "$TMPFILE"

        if echo "$UPLOAD_RESP" | grep -q "\"key\"\|\"id\""; then
            ok "Uploaded: Guide de demarrage.md"
        else
            skip "Guide de demarrage.md (may already exist or upload failed)"
        fi

        # Create a sample CSV file (simulated budget)
        BUDGET_CONTENT='Poste,Budget Prevu,Depenses,Restant
Infrastructure,15000,8500,6500
Licences logicielles,5000,4200,800
Formation equipe,3000,1500,1500
Marketing,8000,6000,2000
Support technique,4000,2800,1200
Materiel informatique,10000,7500,2500
Frais generaux,6000,5000,1000
TOTAL,51000,35500,15500'

        TMPFILE=$(mktemp --suffix=.csv 2>/dev/null || mktemp)
        echo "$BUDGET_CONTENT" > "$TMPFILE"

        UPLOAD_RESP=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
            -F "file=@${TMPFILE};filename=Budget exemple.csv;type=text/csv" \
            "$STORAGE_URL/files/$DEFAULT_BUCKET" 2>/dev/null)
        rm -f "$TMPFILE"

        if echo "$UPLOAD_RESP" | grep -q "\"key\"\|\"id\""; then
            ok "Uploaded: Budget exemple.csv"
        else
            skip "Budget exemple.csv (may already exist or upload failed)"
        fi

        # Create a SignApps presentation outline (markdown)
        PRES_CONTENT='# Presentation SignApps

## Slide 1 — Titre
**SignApps Platform**
Votre suite collaborative 100% locale

## Slide 2 — Vision
- Souverainete des donnees
- Pas de cloud externe
- Performance native

## Slide 3 — Modules
| Module | Description |
|--------|-------------|
| Mail | Messagerie complete |
| Docs | Edition collaborative |
| Calendar | Planification |
| Drive | Stockage fichiers |
| Chat | Messagerie instantanee |
| Meet | Visioconference |
| AI | Intelligence artificielle |

## Slide 4 — Architecture
- Backend Rust (performance & securite)
- Frontend Next.js (experience moderne)
- PostgreSQL (fiabilite)
- Zero dependance cloud

## Slide 5 — Prochaines etapes
1. Installation pilote
2. Migration des donnees
3. Formation utilisateurs
4. Mise en production

---
*Document de demonstration SignApps*'

        TMPFILE=$(mktemp --suffix=.md 2>/dev/null || mktemp)
        echo "$PRES_CONTENT" > "$TMPFILE"

        UPLOAD_RESP=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
            -F "file=@${TMPFILE};filename=Presentation SignApps.md;type=text/markdown" \
            "$STORAGE_URL/files/$DEFAULT_BUCKET" 2>/dev/null)
        rm -f "$TMPFILE"

        if echo "$UPLOAD_RESP" | grep -q "\"key\"\|\"id\""; then
            ok "Uploaded: Presentation SignApps.md"
        else
            skip "Presentation SignApps.md (may already exist or upload failed)"
        fi
    fi
    echo ""
fi

# ══════════════════════════════════════════════════════════════════════════════
# CONTACTS — Demo contacts (via Identity/Contacts service)
# ══════════════════════════════════════════════════════════════════════════════
echo -e "  ${CYAN}Creating demo contacts...${NC}"

# Contacts are stored in the contacts service (port 3021) if available,
# otherwise we output them as JSON for localStorage seeding
CONTACTS_URL="${CONTACTS_URL:-http://localhost:3021/api/v1}"
CONTACTS_OK=false
if check_port 3021; then CONTACTS_OK=true; fi

declare -a CONTACT_NAMES=(
    "Sophie Lefevre"
    "Thomas Bernard"
    "Isabelle Moreau"
    "Nicolas Petit"
    "Camille Roux"
    "Antoine Dubois"
    "Emilie Laurent"
    "Pierre Girard"
    "Julie Bonnet"
    "Francois Lemaire"
)
declare -a CONTACT_EMAILS=(
    "sophie.lefevre@acme.fr"
    "thomas.bernard@techcorp.fr"
    "isabelle.moreau@durand-associes.fr"
    "nicolas.petit@innovatech.fr"
    "camille.roux@mediaplus.fr"
    "antoine.dubois@construire.fr"
    "emilie.laurent@santeplus.fr"
    "pierre.girard@logisys.fr"
    "julie.bonnet@creativ.fr"
    "francois.lemaire@financegroup.fr"
)
declare -a CONTACT_PHONES=(
    "+33 6 12 34 56 78"
    "+33 6 23 45 67 89"
    "+33 6 34 56 78 90"
    "+33 6 45 67 89 01"
    "+33 6 56 78 90 12"
    "+33 6 67 89 01 23"
    "+33 6 78 90 12 34"
    "+33 6 89 01 23 45"
    "+33 6 90 12 34 56"
    "+33 6 01 23 45 67"
)
declare -a CONTACT_COMPANIES=(
    "ACME Solutions"
    "TechCorp"
    "Durand & Associes"
    "InnovaTech"
    "MediaPlus"
    "Construire SA"
    "SantePlus"
    "LogiSys"
    "Creativ Agency"
    "Finance Group"
)
declare -a CONTACT_TITLES=(
    "Directrice Marketing"
    "Developpeur Senior"
    "Avocate"
    "Chef de Projet"
    "Responsable Communication"
    "Architecte"
    "Medecin"
    "Administrateur Systeme"
    "Designer UX"
    "Analyste Financier"
)

if $CONTACTS_OK; then
    for i in "${!CONTACT_NAMES[@]}"; do
        NAME="${CONTACT_NAMES[$i]}"
        EMAIL="${CONTACT_EMAILS[$i]}"
        PHONE="${CONTACT_PHONES[$i]}"
        COMPANY="${CONTACT_COMPANIES[$i]}"
        TITLE="${CONTACT_TITLES[$i]}"

        if $DRY_RUN; then
            dry "Would create contact: $NAME ($EMAIL)"
            continue
        fi

        # Check if contact exists
        EXISTING=$(api_get "$CONTACTS_URL/contacts?search=$EMAIL" 2>/dev/null)
        if echo "$EXISTING" | grep -q "$EMAIL" && ! $FORCE; then
            skip "Contact '$NAME' already exists"
            continue
        fi

        RESP=$(api_post "$CONTACTS_URL/contacts" "{
            \"display_name\": \"$NAME\",
            \"email\": \"$EMAIL\",
            \"phone\": \"$PHONE\",
            \"company\": \"$COMPANY\",
            \"job_title\": \"$TITLE\"
        }" 2>/dev/null)

        if echo "$RESP" | grep -q "\"id\""; then
            ok "Created contact: $NAME"
        else
            fail "Failed to create contact '$NAME'"
        fi
    done
else
    # Output contacts as JSON for localStorage seeding
    info "Contacts service not running — generating localStorage seed file"
    CONTACTS_JSON="["
    for i in "${!CONTACT_NAMES[@]}"; do
        [[ $i -gt 0 ]] && CONTACTS_JSON+=","
        CONTACTS_JSON+="{
            \"id\": \"demo-contact-$((i+1))\",
            \"display_name\": \"${CONTACT_NAMES[$i]}\",
            \"email\": \"${CONTACT_EMAILS[$i]}\",
            \"phone\": \"${CONTACT_PHONES[$i]}\",
            \"company\": \"${CONTACT_COMPANIES[$i]}\",
            \"job_title\": \"${CONTACT_TITLES[$i]}\"
        }"
    done
    CONTACTS_JSON+="]"

    CONTACTS_FILE="$BASE_DIR/data/seed-contacts.json"
    mkdir -p "$BASE_DIR/data"
    echo "$CONTACTS_JSON" > "$CONTACTS_FILE"
    ok "Saved contacts to $CONTACTS_FILE (import via frontend)"
fi
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════
echo -e "  ${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "  ${CYAN}║           Seeding Complete               ║${NC}"
echo -e "  ${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${GREEN}Demo data has been populated.${NC}"
echo -e "  ${GRAY}Open http://localhost:3000 to see the app with data.${NC}"
echo ""
echo -e "  ${GRAY}Demo accounts:${NC}"
echo -e "    admin / $ADMIN_PASS  ${GRAY}(administrator)${NC}"
echo -e "    marie.dupont / Demo1234!  ${GRAY}(editor)${NC}"
echo -e "    jean.martin / Demo1234!  ${GRAY}(viewer)${NC}"
echo ""
