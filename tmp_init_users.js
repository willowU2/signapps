const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/signapps'
});

async function run() {
    await client.connect();
    
    try {
        console.log("Checking for users without a calendar...");
        const result = await client.query(`
            SELECT id FROM identity.users 
            WHERE id NOT IN (SELECT DISTINCT owner_id FROM calendar.calendars)
        `);
        
        const users = result.rows;
        if (users.length === 0) {
            console.log("All users already have a calendar!");
            return;
        }

        console.log(`Found ${users.length} users requiring initialization. Creating...`);

        for (const user of users) {
            const calendarId = uuidv4();
            await client.query(`
                INSERT INTO calendar.calendars (id, owner_id, name, description, timezone, color, is_shared)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                calendarId,
                user.id,
                'Mon Calendrier',
                "Calendrier personnel de l'utilisateur",
                'UTC',
                '#3b82f6',
                false
            ]);

            const taskId = uuidv4();
            await client.query(`
                INSERT INTO calendar.tasks (id, calendar_id, parent_task_id, title, description, priority, position, status, created_by, assigned_to)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                taskId,
                calendarId,
                null,
                'Mes Tâches',
                "Liste principale des tâches de l'utilisateur",
                1,
                0,
                'open',
                user.id,
                user.id
            ]);
            console.log(`Successfully initialized user ${user.id}`);
        }
    } catch (err) {
        console.error("Migration Error:", err);
    } finally {
        await client.end();
    }
}

run();
