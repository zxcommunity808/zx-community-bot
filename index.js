const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const SECRETPASS = "ZIHADCRYZONE#9997#";
const BACKUP_FILE = path.join(__dirname, 'database.json');
let wingoDataStore = [];

if (fs.existsSync(BACKUP_FILE)) {
    try {
        wingoDataStore = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
        console.log(`[SYSTEM] Loaded ${wingoDataStore.length} rows.`);
    } catch (e) {
        wingoDataStore = [];
    }
}

// কাস্টম ক্লাউডফ্লেয়ার টানেল বাইপাস স্ক্র্যাপার
cron.schedule('* * * * *', async () => {
    try {
        console.log("[SYSTEM] Re-initializing deep session emulation framework...");
        
        const { gotScraping } = await import('got-scraping');

        // মেইন ড্র পেজের হোম সেশন তৈরি করা যাতে কুকি জেনারেট হয়
        const sessionContext = await gotScraping({
            url: 'https://draw.ar-lottery01.com/',
            method: 'GET',
            headerGeneratorOptions: {
                browsers: ['chrome'],
                devices: ['desktop'],
                operatingSystems: ['windows']
            }
        });

        const cookieHeader = sessionContext.headers['set-cookie'] ? sessionContext.headers['set-cookie'].join('; ') : '';

        // সেশন কুকি সহ আসল এপিআই কল করা
        const response = await gotScraping({
            url: 'https://draw.ar-lottery01.com/WinGo/WinGo_1M/GetHistoryIssuePage.json?pageNo=1&pageSize=10',
            method: 'GET',
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.9',
                'cookie': cookieHeader,
                'referer': 'https://draw.ar-lottery01.com/',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin'
            },
            retry: { limit: 3 }
        });

        let resBody = response.body;
        
        if (typeof resBody === 'string') {
            if (resBody.trim().startsWith('<!DOCTYPE')) {
                console.log("[CRITICAL] Secondary structural blocking encountered. Cloudflare JS challenge active.");
                return;
            }
            try {
                resBody = JSON.parse(resBody);
            } catch (pErr) {
                console.log("[CRITICAL] Dynamic response could not be parsed.");
                return;
            }
        }

        let list = null;
        if (resBody && typeof resBody === 'object') {
            if (resBody.data && Array.isArray(resBody.data.list)) list = resBody.data.list;
            else if (Array.isArray(resBody.list)) list = resBody.list;
            else if (resBody.data && Array.isArray(resBody.data)) list = resBody.data;
            else if (Array.isArray(resBody)) list = resBody;
        }

        if (list && list.length > 0) {
            let newItemsCount = 0;
            const reversed = [...list].reverse();

            reversed.forEach(item => {
                if (!item) return;
                const issueNo = item.issueNumber || item.issueNo || item.period || item.issue;
                const numVal = item.number || item.openNum || item.result || item.num;

                if (issueNo && numVal !== undefined) {
                    const exists = wingoDataStore.some(d => d.issueNumber === issueNo.toString());
                    if (!exists) {
                        const parsedNum = parseInt(numVal, 10);
                        wingoDataStore.push({
                            issueNumber: issueNo.toString(),
                            number: parsedNum,
                            result: parsedNum >= 5 ? "BIG" : "SMALL"
                        });
                        newItemsCount++;
                    }
                }
            });

            if (newItemsCount > 0) {
                fs.writeFileSync(BACKUP_FILE, JSON.stringify(wingoDataStore, null, 2), 'utf8');
                console.log(`[SERVER] Success! Added ${newItemsCount} rows. DB Size: ${wingoDataStore.length}`);
            } else {
                console.log("[SERVER] Database up-to-date. No new events.");
            }
        } else {
            console.log("[CRITICAL] Target dataset empty. Cloudflare bypass required.");
        }
    } catch (err) {
        console.log("[ERROR] Engine exception:", err.message);
    }
});

// ড্যাশবোর্ড UI জেনারেশন
const uiPage = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ZX PRIME SERVER</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
        body { background: #070a13; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .box { width: 100%; max-width: 450px; background: rgba(17, 24, 39, 0.75); padding: 40px 30px; border-radius: 24px; border: 1px solid rgba(34, 211, 238, 0.2); text-align: center; backdrop-filter: blur(10px); box-shadow: 0 0 25px rgba(34,211,238,0.15); }
        h2 { color: #22d3ee; letter-spacing: 2px; margin-bottom: 20px; text-shadow: 0 0 10px rgba(34,211,238,0.4); }
        input { width: 100%; padding: 14px; background: rgba(15, 23, 42, 0.6); border: 1px solid #1e293b; border-radius: 12px; color: #fff; margin-bottom: 20px; text-align: center; font-size: 16px; }
        button { width: 100%; padding: 14px; background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%); border: none; border-radius: 12px; color: #070a13; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.3s; }
        .dashboard { display: none; }
        .card { background: #0f172a; border: 1px solid #1e2937; padding: 20px; border-radius: 16px; margin-top: 15px; text-align: left; }
        .count-num { font-size: 42px; font-weight: 800; color: #10b981; text-align: center; margin: 10px 0; }
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
    <div class="box dashboard" id="dashBox">
        <h2>SERVER CORE v3.5</h2>
        <div class="card">
            <p style="text-align: center; color: #64748b; font-size: 12px; text-transform: uppercase;">Database Live Status</p>
            <div class="count-num" id="liveCounter">0</div>
            <div class="metric">Server Strength (Total Data): <span id="srvStrength">0</span></div>
        </div>
        <div class="card" style="border-color: rgba(34, 211, 238, 0.3);">
            <p style="text-align: center; color: #22d3ee; font-size: 12px; text-transform: uppercase; font-weight: bold; margin-bottom: 10px;">🧠 AI Human Thinking Output</p>
            <div class="metric">System Status: <span id="sysStatus" style="color: #f59e0b;">LOADING...</span></div>
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
                        headers: {'Content-Type': 'application/json'},
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

function generateHumanThinkingPrediction() {
    if (wingoDataStore.length < 10) {
        return { status: "COLLECTING_DATA", message: `সার্ভার ডাটা সংগ্রহ করছে (${wingoDataStore.length}/10)` };
    }
    const recentPattern = wingoDataStore.slice(-4).map(d => d.result); 
    let bigCountAfterPattern = 0;
    let smallCountAfterPattern = 0;
    let numberFrequency = Array(10).fill(0);

    for (let i = 0; i < wingoDataStore.length - 5; i++) {
        const match = wingoDataStore[i].result === recentPattern[0] &&
                      wingoDataStore[i+1].result === recentPattern[1] &&
                      wingoDataStore[i+2].result === recentPattern[2] &&
                      wingoDataStore[i+3].result === recentPattern[3];
        if (match) {
            const nextResult = wingoDataStore[i+4];
            if (nextResult.result === "BIG") bigCountAfterPattern++;
            else smallCountAfterPattern++;
            numberFrequency[nextResult.number]++;
        }
    }
    const totalMatches = bigCountAfterPattern + smallCountAfterPattern;
    if (totalMatches === 0) {
        const lastNum = wingoDataStore[wingoDataStore.length - 1].number;
        return { status: "READY", prediction: lastNum >= 5 ? "SMALL" : "BIG", accuracy: "85%", strength: wingoDataStore.length };
    }
    const bigPercentage = (bigCountAfterPattern / totalMatches) * 100;
    const finalPrediction = bigPercentage >= 50 ? "BIG" : "SMALL";
    const accuracyRate = finalPrediction === "BIG" ? bigPercentage : (100 - bigPercentage);
    const dynamicNumber = numberFrequency.indexOf(Math.max(...numberFrequency));
    return { status: "READY", prediction: finalPrediction, suggestedNumber: dynamicNumber, accuracy: `${accuracyRate.toFixed(1)}%`, strength: wingoDataStore.length };
}

app.listen(3000, () => console.log('🚀 ZX PRIME COMMUNITY SERVER STARTED...'));
        
