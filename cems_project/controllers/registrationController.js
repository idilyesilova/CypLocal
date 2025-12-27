const db = require('../db/database');

exports.registerToEvent = async (req, res) => {
    const { citizenID, eventID } = req.body;

    try {
        // 1. ADIM: Etkinliği bul ve kapasitesine bak
        const [rows] = await db.query('SELECT capacity FROM events WHERE event_id = ?', [eventID]);
        
        if (rows.length === 0) return res.status(404).json({ message: "Event not found" });

        const capacity = rows[0].capacity;

        // 2. ADIM: Kapasite kontrolü (Algoritmanın kalbi)
        if (capacity > 0) {
            // Kayıt işlemini yap
            await db.query('INSERT INTO registrations (citizen_id, event_id, reg_date) VALUES (?, ?, NOW())', [citizenID, eventID]);
            
            // Kapasiteyi bir azalt (Update logic)
            await db.query('UPDATE events SET capacity = capacity - 1 WHERE event_id = ?', [eventID]);
            
            res.status(200).json({ success: true, message: "Registration successful!" });
        } else {
            // Kapasite dolu mesajı döndür
            res.status(400).json({ success: false, message: "Full Capacity" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};