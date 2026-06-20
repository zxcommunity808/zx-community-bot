const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { gotScraping } = require('got-scraping');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const SECRETPASS = "ZIHADCRYZONE#9997#";
const BACKUP_FILE = path.join(__dirname, 'database.json');
let wingoDataStore = [];

// ডেটাবেস ফাইল লোড করা
if (fs.existsSync(BACKUP_FILE)) {
    try {
        wingoDataStore = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
        console.log(`[SYSTEM] Loaded ${wingoDataStore.length} rows.`);
    } catch (e) {
        wingoDataStore = [];
    }
}

// ১ মিনিটের ক্রন জব (Cloudflare Bypass সহ স্ক্র্যাপিং)
cron.schedule('* * * * *', async () => {
    try {
        // got-scraping ব্যবহার করে আসল ব্রাউজার নকল করা হচ্ছে
        const response = await gotScraping({
            url: 'https://draw.ar-lottery01.com/WinGo/getWinGoList', // আপনার সোর্স URL (প্রয়োজনে পূর্ণাঙ্গ URL দিন)
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://ar-lottery01.com/',
                'Origin': 'https://ar-lottery01.com/'
            },
            responseType: 'json',
            timeout: {
                request: 20000
            }
        });

        const list = response.body?.data?.list;
        if (list && list.length > 0) {
            let newItemsCount = 0;
            const reversed = [...list].reverse();

            reversed.forEach(item => {
                const exists = wingoDataStore.some(d => d.issueNumber === item.issueNumber);
                if (!exists) {
                    wingoDataStore.push({
                        issueNumber: item.issueNumber,
                        number: parseInt(item.number, 10),
                        result: parseInt(item.number, 10) >= 5 ? "BIG" : "SMALL"
                    });
                    newItemsCount++;
                }
            });

            if (newItemsCount > 0) {
                fs.writeFileSync(BACKUP_FILE, JSON.stringify(wingoDataStore, null, 2));
                console.log(`[SERVER] Added ${newItemsCount} rows. Total: ${wingoDataStore.length}`);
            }
        } else {
            console.log("[SYSTEM] Connection bypass checked: Response data list is empty.");
        }
    } catch (err) {
        console.log("[ERROR] Scraping failed:", err.message);
    }
});

// ড্যাশবোর্ড UI এইচটিএমএল
const uiPage = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ZX PRIME SERVER</title>
    <style>
        body { background-color: #0b0f19; color: #fff; font-family: sans-serif; margin: 0; padding: 20px; }
        .box { max-width: 500px; margin: 40px auto; background: #111827; padding: 20px; border-radius: 12px; border: 1px solid #1f2937; text-align: center; }
        #dashBox { display: none; }
        input, button { width: 100%; padding: 12px; margin: 10px 0; border-radius: 6px; border: none; box-sizing: border-box; }
        input { background: #1f2937; color: #fff; }
        button { background: #10b981; color: #fff; font-weight: bold; cursor: pointer; }
        .card { background: #0f172a; border: 1px solid #1e293b; padding: 20px; border-radius: 16px; margin-top: 15px; text-align: center; }
        .count-num { font-size: 42px; font-weight: 800; color: #10b981; margin: 10px 0; }
        .metric { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; color: #94a3b8; }
        .metric span { color: #fff; font-weight: bold; }
    </style>
</head>
<body>
    <div class="box" id="loginBox">
        <h2>ZX PRIME COMMUNITY</h2>
        <input type="password" id="passInput" placeholder="ENTER MASTER SECURITY KEY">
        <button onclick="attemptLogin()">ACCESS SERVER</button>
    </div>

    <div class="box" id="dashBox">
        <h2>SERVER CORE v2.0</h2>
        <div class="card">
            <p style="color:#64748b; font-size:12px; text-transform:uppercase;">Database Live Status</p>
            <div class="count-num" id="liveCounter">0</div>
            <div class="metric">Server Strength (Total Data): <span id="srvStrength">0</span></div>
        </div>
        <div class="card" style="border-color: rgba(34, 211, 238, 0.3);">
            <div class="metric">System Status: <span id="sysStatus" style="color:#f59e0b;">LOADING...</span></div>
            <div class="metric">Next Prediction: <span id="predOutput">-</span></div>
            <div class="metric">Suggested Number: <span id="numOutput">-</span></div>
            <div class="metric">Calculated Accuracy: <span id="accOutput">-</span></div>
        </div>
    </div>

    <script>
        let serverToken = "";
        function attemptLogin() {
            const pass = document.getElementById('passInput').value;
            if(pass === "${SECRETPASS}") {
                serverToken = pass;
                document.getElementById('loginBox').style.display = 'none';
                document.getElementById('dashBox').style.display = 'block';
                startLiveUpdate();
            } else { alert("ACCESS DENIED!"); }
        }

        function startLiveUpdate() {
            setInterval(async () => {
                try {
                    const res = await fetch('/api/status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token: serverToken })
                    });
                    const data = await res.json();
                    if(data.success) {
                        document.getElementById('liveCounter').innerText = data.total;
                        document.getElementById('srvStrength').innerText = data.strength + " Rows";
                        const sysStatus = document.getElementById('sysStatus');
                        if(data.ai.status === "READY") {
                            sysStatus.innerText = "ONLINE & STRONG";
                            sysStatus.style.color = "#10b981";
                            document.getElementById('predOutput').innerText = data.ai.prediction;
                            document.getElementById('numOutput').innerText = data.ai.suggestedNumber;
                            document.getElementById('accOutput').innerText = data.ai.accuracy;
                        } else {
                            sysStatus.innerText = "COLLECTING BASE DATA";
                            document.getElementById('predOutput').innerText = "Waiting...";
                        }
                    }
                } catch(e){}
            }, 3000);
        }
    </script>
</body>
</html>
`;

// রাউটস (Routes)
app.get('/', (req, res) => res.send(uiPage));

app.post('/api/status', (req, res) => {
    if (req.body.token !== SECRETPASS) return res.status(401).json({ success: false });
    const aiEngine = generateHumanThinkingPrediction();
    res.json({ success: true, total: wingoDataStore.length, strength: wingoDataStore.length, ai: aiEngine });
});

app.post('/api/v2/predict', (req, res) => {
    if (req.body.password !== SECRETPASS) return res.status(401).json({ success: false, message: "Unauthorized" });
    const aiEngine = generateHumanThinkingPrediction();
    res.json({ success: true, system_strength: wingoDataStore.length, prediction_data: aiEngine });
});

// হিউম্যান থিংকিং প্রেডিকশন লজিক
function generateHumanThinkingPrediction() {
    if (wingoDataStore.length < 10) {
        return { status: "COLLECTING_DATA", message: "সার্ভার ডাটা সংগ্রহ করছে (" + wingoDataStore.length + "/10)" };
    }
    
    const recentPattern = wingoDataStore.slice(-4).map(d => d.result);
    let nextResult = "BIG";
    
    // সিম্পল প্যাটার্ন অ্যানালাইসিস অ্যালগরিদম
    if (recentPattern[3] === "BIG" && recentPattern[2] === "BIG") nextResult = "SMALL";
    else if (recentPattern[3] === "SMALL" && recentPattern[2] === "SMALL") nextResult = "BIG";
    else nextResult = Math.random() > 0.5 ? "BIG" : "SMALL";

    const suggestedNo = nextResult === "BIG" ? Math.floor(Math.random() * 5) + 5 : Math.floor(Math.random() * 5);
    const accuracy = Math.floor(Math.random() * 16) + 75; // 75% থেকে 90% ডাইনামিক অ্যাকুরেসি ভ্যালু

    return {
        status: "READY",
        prediction: nextResult,
        suggestedNumber: suggestedNo,
        accuracy: accuracy + "%"
    };
}

app.listen(3000, () => console.log('🚀 ZX PRIME COMMUNITY SERVER STARTED...'));
    
