/* ==========================================================================
   さんすう・けいさんゲーム 共通JavaScriptライブラリ (game-common.js)
   ========================================================================== */

// --- 1. 効果音・サウンドマネージャー ---
class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playClick() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.06);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);

        osc.start(now);
        osc.stop(now + 0.06);
    }

    playCorrect(combo = 1) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const baseFreq = 523.25; // C5
        const pitchShift = Math.min((combo - 1) * 40, 300); // コンボで音が高くなる！

        // メロディ（ド・ミ・ソ）
        const notes = [baseFreq + pitchShift, (baseFreq * 1.25) + pitchShift, (baseFreq * 1.5) + pitchShift];
        
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            const startTime = now + (idx * 0.07);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.15, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);

            osc.start(startTime);
            osc.stop(startTime + 0.25);
        });
    }

    playIncorrect() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.25);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

        osc.start(now);
        osc.stop(now + 0.25);
    }

    playFanfare() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        // ファンファーレ (ソ・ド・ミ・ソ〜)
        const notes = [
            { f: 392.00, d: 0.1, t: 0 },
            { f: 523.25, d: 0.1, t: 0.1 },
            { f: 659.25, d: 0.1, t: 0.2 },
            { f: 783.99, d: 0.35, t: 0.3 }
        ];

        notes.forEach(note => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            const startTime = now + note.t;
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(note.f, startTime);

            gain.gain.setValueAtTime(0.18, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + note.d);

            osc.start(startTime);
            osc.stop(startTime + note.d);
        });
    }
}

const sounds = new SoundManager();

// 画面クリック時にサウンドコンテキストを復元
window.addEventListener('pointerdown', () => sounds.init(), { once: true });


// --- 2. スコア & 記録マネージャー (localStorage) ---
class ScoreStore {
    static getGameData(gameId) {
        try {
            const data = localStorage.getItem(`sansu_${gameId}`);
            return data ? JSON.parse(data) : { highScore: 0, bestTime: null, stars: 0, plays: 0 };
        } catch(e) {
            return { highScore: 0, bestTime: null, stars: 0, plays: 0 };
        }
    }

    static saveGameData(gameId, { score = 0, time = null, stars = 0 }) {
        try {
            const current = this.getGameData(gameId);
            const newHighScore = Math.max(current.highScore || 0, score);
            const newBestTime = (time !== null && (current.bestTime === null || time < current.bestTime)) ? time : current.bestTime;
            const newStars = Math.max(current.stars || 0, stars);

            const updated = {
                highScore: newHighScore,
                bestTime: newBestTime,
                stars: newStars,
                plays: (current.plays || 0) + 1,
                lastPlayed: new Date().toISOString()
            };

            localStorage.setItem(`sansu_${gameId}`, JSON.stringify(updated));
            return {
                isNewHigh: newHighScore > (current.highScore || 0),
                isNewBestTime: time !== null && (current.bestTime === null || time < current.bestTime),
                data: updated
            };
        } catch(e) {
            return { isNewHigh: false, isNewBestTime: false, data: {} };
        }
    }

    static getAllStats() {
        const games = ['flash', 'tashizan', 'hikizan', 'keisan2', 'bunshou', 'warizanz', 'gumnan', 'chain', 'nazori'];
        const stats = {};
        let totalStars = 0;
        let totalPlays = 0;

        games.forEach(g => {
            const data = this.getGameData(g);
            stats[g] = data;
            totalStars += data.stars || 0;
            totalPlays += data.plays || 0;
        });

        return { stats, totalStars, totalPlays };
    }
}


// --- 3. 物理キーボード対応ヘルパー ---
class KeyboardHelper {
    static bindNumPad(onKey, onEnter, onClear) {
        window.addEventListener('keydown', (e) => {
            // 他のテキスト入力フィールドにフォーカスがある時は無視
            if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && 
                document.activeElement.type !== 'radio' && document.activeElement.type !== 'button') {
                if (e.key !== 'Enter' && e.key !== 'Escape') return;
            }

            if (e.key >= '0' && e.key <= '9') {
                sounds.playClick();
                if (onKey) onKey(e.key);
            } else if (e.key === 'Enter') {
                sounds.playClick();
                if (onEnter) onEnter();
            } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'c' || e.key === 'C') {
                sounds.playClick();
                if (onClear) onClear();
            }
        });
    }
}


// --- 4. 演出ヘルパー (紙吹雪・コンボテキスト・浮遊スター) ---
class FXHelper {
    static showComboText(text, container = document.body) {
        const pop = document.createElement('div');
        pop.className = 'fx-pop-text';
        pop.innerText = text;
        pop.style.left = '50%';
        pop.style.top = '40%';
        container.appendChild(pop);

        setTimeout(() => pop.remove(), 700);
    }

    static createConfetti(count = 30) {
        const colors = ['#2ecc71', '#ffca28', '#3498db', '#e74c3c', '#9b59b6', '#ff7675', '#1dd1a1'];
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            const size = Math.random() * 9 + 5;
            p.style.width = `${size}px`;
            p.style.height = `${size}px`;
            p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            p.style.left = '50%';
            p.style.top = '40%';
            document.body.appendChild(p);

            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 160 + 80;
            const dx = Math.cos(angle) * velocity;
            const dy = Math.sin(angle) * velocity - 30;

            const anim = p.animate([
                { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
                { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0)`, opacity: 0 }
            ], {
                duration: 600,
                easing: 'cubic-bezier(0.1, 0.8, 0.25, 1)',
                fill: 'forwards'
            });

            anim.onfinish = () => p.remove();
        }
    }
}
