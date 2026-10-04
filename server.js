const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'rental_market.db');
const db = new sqlite3.Database(dbPath);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function initializeDatabase() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('lender', 'renter')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        location TEXT NOT NULL,
        price REAL NOT NULL,
        bedrooms INTEGER NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        lender_id INTEGER NOT NULL,
        status TEXT DEFAULT 'available',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(lender_id) REFERENCES users(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        renter_id INTEGER NOT NULL,
        listing_id INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT DEFAULT 'confirmed',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(renter_id) REFERENCES users(id),
        FOREIGN KEY(listing_id) REFERENCES listings(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        renter_id INTEGER NOT NULL,
        listing_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(renter_id, listing_id),
        FOREIGN KEY(renter_id) REFERENCES users(id),
        FOREIGN KEY(listing_id) REFERENCES listings(id)
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id INTEGER NOT NULL,
        receiver_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(sender_id) REFERENCES users(id),
        FOREIGN KEY(receiver_id) REFERENCES users(id)
      )
    `);

    const seedUsers = [
      ['Lender Admin', 'lender@demo.com', '123456', 'lender'],
      ['Renter User', 'renter@demo.com', '123456', 'renter']
    ];

    db.get('SELECT COUNT(*) AS count FROM users', (err, row) => {
      if (err) {
        console.error('Error counting users:', err);
        return;
      }

      if (row.count === 0) {
        const insertUser = db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)');
        seedUsers.forEach(([name, email, password, role]) => insertUser.run(name, email, password, role));
        insertUser.finalize();
      }
    });

    db.get('SELECT COUNT(*) AS count FROM listings', (err, row) => {
      if (err) {
        console.error('Error counting listings:', err);
        return;
      }

      if (row.count === 0) {
        const insertListing = db.prepare(`
          INSERT INTO listings (title, location, price, bedrooms, type, description, lender_id, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertListing.run('Downtown Loft', 'Manila, Philippines', 1200, 2, 'Apartment', 'Modern loft with skyline views and secure parking.', 1, 'available');
        insertListing.run('Coastal Villa', 'Cebu, Philippines', 2100, 4, 'House', 'Spacious villa with pool access and garden view.', 1, 'available');
        insertListing.run('City Studio', 'Quezon City, Philippines', 780, 1, 'Studio', 'Compact and fully furnished unit near business centers.', 1, 'available');
        insertListing.finalize();
      }
    });

    db.get('SELECT COUNT(*) AS count FROM reservations', (err, row) => {
      if (err) {
        console.error('Error counting reservations:', err);
        return;
      }

      if (row.count === 0) {
        const insertReservation = db.prepare(`
          INSERT INTO reservations (renter_id, listing_id, start_date, end_date, status)
          VALUES (?, ?, ?, ?, ?)
        `);

        insertReservation.run(2, 1, '2026-11-01', '2026-11-14', 'confirmed');
        insertReservation.run(2, 2, '2026-12-05', '2026-12-20', 'pending');
        insertReservation.finalize();
      }
    });

    db.get('SELECT COUNT(*) AS count FROM favorites', (err, row) => {
      if (err) {
        console.error('Error counting favorites:', err);
        return;
      }

      if (row.count === 0) {
        const insertFavorite = db.prepare('INSERT INTO favorites (renter_id, listing_id) VALUES (?, ?)');
        insertFavorite.run(2, 2);
        insertFavorite.run(2, 3);
        insertFavorite.finalize();
      }
    });

    db.get('SELECT COUNT(*) AS count FROM messages', (err, row) => {
      if (err) {
        console.error('Error counting messages:', err);
        return;
      }

      if (row.count === 0) {
        const insertMessage = db.prepare('INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)');
        insertMessage.run(1, 2, 'Hi! Your booking request is under review.');
        insertMessage.run(2, 1, 'Thank you. I would like to ask about the rental terms.');
        insertMessage.run(1, 2, 'Certainly. Please review the policies section in your dashboard.');
        insertMessage.finalize();
      }
    });
  });
}

app.post('/api/login', (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required.' });
  }

  db.get(
    'SELECT id, name, email, role FROM users WHERE email = ? AND password = ? AND role = ?',
    [email.trim(), password, role],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error.' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials for the selected account type.' });
      }

      return res.json({ user });
    }
  );
});

app.get('/api/dashboard', (req, res) => {
  const { role, userId } = req.query;

  if (!role || !userId) {
    return res.status(400).json({ error: 'Role and userId are required.' });
  }

  if (role === 'lender') {
    db.all(
      `SELECT l.id, l.title, l.location, l.price, l.bedrooms, l.type, l.description, l.status,
              u.name AS lender_name
       FROM listings l
       INNER JOIN users u ON u.id = l.lender_id
       WHERE l.lender_id = ?
       ORDER BY l.id DESC`,
      [userId],
      (err, listings) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch lender listings.' });

        db.all(
          `SELECT r.id, r.status, r.start_date, r.end_date, l.title AS listing_title, u.name AS renter_name
           FROM reservations r
           INNER JOIN listings l ON l.id = r.listing_id
           INNER JOIN users u ON u.id = r.renter_id
           WHERE l.lender_id = ?
           ORDER BY r.created_at DESC`,
          [userId],
          (reservationErr, rentals) => {
            if (reservationErr) return res.status(500).json({ error: 'Failed to fetch rentals.' });

            db.all(
              `SELECT m.id, m.message, m.created_at, sender.name AS sender_name
               FROM messages m
               JOIN users sender ON sender.id = m.sender_id
               WHERE m.receiver_id = ?
               ORDER BY m.created_at DESC`,
              [userId],
              (messageErr, messages) => {
                if (messageErr) return res.status(500).json({ error: 'Failed to fetch messages.' });

                return res.json({ listings, rentals, messages });
              }
            );
          }
        );
      }
    );
  }

  if (role === 'renter') {
    db.all(
      `SELECT l.id, l.title, l.location, l.price, l.bedrooms, l.type, l.description, l.status,
              u.name AS lender_name
       FROM listings l
       JOIN users u ON u.id = l.lender_id
       ORDER BY l.id DESC`,
      (err, listings) => {
        if (err) return res.status(500).json({ error: 'Failed to fetch rental listings.' });

        db.all(
          `SELECT r.id, r.status, r.start_date, r.end_date, l.title AS listing_title, l.price
           FROM reservations r
           INNER JOIN listings l ON l.id = r.listing_id
           WHERE r.renter_id = ?
           ORDER BY r.created_at DESC`,
          [userId],
          (reservationErr, reservations) => {
            if (reservationErr) return res.status(500).json({ error: 'Failed to fetch reservations.' });

            db.all(
              `SELECT f.id, l.title AS listing_title, l.location, l.price
               FROM favorites f
               JOIN listings l ON l.id = f.listing_id
               WHERE f.renter_id = ?
               ORDER BY f.created_at DESC`,
              [userId],
              (favoriteErr, favorites) => {
                if (favoriteErr) return res.status(500).json({ error: 'Failed to fetch favorites.' });

                db.all(
                  `SELECT m.id, m.message, m.created_at, sender.name AS sender_name
                   FROM messages m
                   JOIN users sender ON sender.id = m.sender_id
                   WHERE m.receiver_id = ?
                   ORDER BY m.created_at DESC`,
                  [userId],
                  (messageErr, messages) => {
                    if (messageErr) return res.status(500).json({ error: 'Failed to fetch messages.' });

                    return res.json({ listings, reservations, favorites, messages });
                  }
                );
              }
            );
          }
        );
      }
    );
  }

  return res.status(400).json({ error: 'Unsupported role.' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initializeDatabase();

app.listen(PORT, () => {
  console.log(`Rental marketplace running at http://localhost:${PORT}`);
});
