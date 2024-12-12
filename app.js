const express = require('express');
const session = require('express-session');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const fetch = require('node-fetch');
const { SerialPort } = require('serialport'); 
const app = express();
const credentials = require('./key.json');
const serialPort = new SerialPort({
    path: 'COM3',    
    baudRate: 9600,
}, (err) => {
    if (err) {
        return console.log('Error opening serial port:', err.message);
    }
    console.log('Serial port opened successfully');
});

serialPort.on('data', (data) => {
    console.log(`Received: ${data}`);
});

admin.initializeApp({
    credential: admin.credential.cert(credentials),
});

const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const PORT = 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'your_session_secret',
    resave: false,
    saveUninitialized: true,
}));

const routes = [
    { path: '/', view: 'index' },
    { path: '/parameters', view: 'parameters' },
    { path: '/agriculture', view: 'agriculture' },
    { path: '/electricity', view: 'electricity' },
    { path: '/construction', view: 'construction' },
    { path: '/domestic', view: 'domestic' },
    { path: '/industry', view: 'industry' },
    { path: '/reports', view: 'reports' },
    { path: '/sensors', view: 'sensors' },
    { path: '/standards', view: 'standards' },
    { path: '/about', view: 'about' },
    { path: '/more-details', view: 'buynow' },
    { path: '/sample-data', view: 'sample-data' },
    { path: '/test', view: 'test' },
    { path: '/login', view: 'login' },
    { path: '/sign_up', view: 'sign_up' },
    { path: '/view-reports', view: 'view_reports' },
    { path: '/forgot_password', view: 'forgot_password' },
];

routes.forEach(({ path, view }) => {
    app.get(path, (req, res) => {
        res.render(view);
    });
});

app.get('/view-report', async (req, res) => {
    try {
        const response = await fetch('https://run.mocky.io/v3/e17dc0d4-33cc-469f-a51d-2855ea40eda9');
        const data = await response.json();
        res.render('view_report', { report: data });
    } catch (error) {
        console.error('Error fetching the report:', error);
        res.status(500).send('Error fetching the report.');
    }
});

app.get('/download-sample-report', (req, res) => {
    const file = path.join(__dirname, 'public', 'sample-report.pdf');
    res.download(file, 'sample-report.pdf', (err) => {
        if (err) {
            console.error('Error downloading the file:', err);
            res.status(500).send('Error downloading the file.');
        } else {
            res.redirect('/view-reports');
        }
    });
});

app.post('/login_process', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send('Email and password are required');
    }

    try {
        const userSnapshot = await db.collection('users').where('email', '==', email).get();
        if (userSnapshot.empty) {
            return res.status(400).send('User not found');
        }
        const userDoc = userSnapshot.docs[0];
        const user = userDoc.data();
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.user = user;
            req.session.user.uid = userDoc.id;
            res.redirect('/index');
        } else {
            res.status(400).send('Invalid password or user');
        }
    } catch (error) {
        res.status(500).send('Error occurred in login: ' + error.message);
    }
});

app.post('/signup_process', async (req, res) => {
    const { name, email, password, confirm_password } = req.body;

    if (!name || !email || !password || !confirm_password) {
        return res.status(400).send('Name, email, and password are required');
    }

    if (password !== confirm_password) {
        return res.status(400).send('Passwords do not match');
    }

    try {
        const existing = await db.collection('users').where('email', '==', email).get();
        if (!existing.empty) {
            return res.status(400).send('User already exists');
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.collection('users').add({
            name,
            email,
            password: hashedPassword,
        });
        res.redirect('/login');
    } catch (error) {
        res.status(500).send('Error occurred: ' + error.message);
    }
});

app.get('/index', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('index', { user: req.session.user });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.post('/forgot_password_process', async (req, res) => {
    const { email, new_password, confirm_password } = req.body;

    if (!email || !new_password || !confirm_password) {
        return res.render('forgot_password', { error: 'All fields are required.' });
    }

    if (new_password !== confirm_password) {
        return res.render('forgot_password', { error: 'Passwords do not match.' });
    }

    try {
        const userSnapshot = await db.collection('users').where('email', '==', email).get();
        if (userSnapshot.empty) {
            return res.render('forgot_password', { error: 'User not found.' });
        }
        const userDoc = userSnapshot.docs[0];
        const hashedPassword = await bcrypt.hash(new_password, 10);

        await db.collection('users').doc(userDoc.id).update({
            password: hashedPassword,
        });

        res.redirect('/login');
    } catch (error) {
        console.error('Error resetting password:', error.message);
        res.render('forgot_password', { error: 'An error occurred. Please try again.' });
    }
});

app.get('/iot-data', (req, res) => {
    serialPort.write('START\n');
    serialPort.once('data', (data) => {
        res.send({ sensorValue: data.toString().trim() });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
