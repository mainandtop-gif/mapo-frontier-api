const nodemailer = require('nodemailer');

const rateMap = {};
function isRateLimited(ip) {
    const now = Date.now();
    if (!rateMap[ip]) rateMap[ip] = [];
    rateMap[ip] = rateMap[ip].filter(t => now - t < 60000);
    if (rateMap[ip].length >= 3) return true;
    rateMap[ip].push(now);
    return false;
}

module.exports = async function handler(req, res) {
    // CORS — Cloudflare Pages 도메인 허용
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Method Not Allowed' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0] || 'unknown';
    if (isRateLimited(ip)) {
        return res.status(429).json({ success: false, error: '잠시 후 다시 시도해주세요.' });
    }

    const { from_name, phone, unit_type, region, message } = req.body || {};

    if (!from_name || !phone) {
        return res.status(400).json({ success: false, error: '성함과 연락처는 필수입니다.' });
    }

    const lines = [
        `이름: ${from_name}`,
        `연락처: ${phone}`,
    ];
    if (unit_type && unit_type !== '미선택') lines.push(`관심 타입: ${unit_type}`);
    if (region   && region   !== '미선택') lines.push(`거주지역: ${region}`);
    if (message  && message  !== '없음')   lines.push(`\n문의사항:\n${message}`);

    const transporter = nodemailer.createTransport({
        host: 'smtp.naver.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.NAVER_USER,       // 환경변수: niceofhi@naver.com
            pass: process.env.NAVER_SMTP_PASS   // 환경변수: 네이버 SMTP 비밀번호
        }
    });

    try {
        await transporter.sendMail({
            from: `"이대역 마포 프론티어" <${process.env.NAVER_USER}>`,
            to:   process.env.NAVER_USER,
            subject: `[이대역 마포 프론티어] 관심등록 — ${from_name}`,
            text: lines.join('\n')
        });
        return res.status(200).json({ success: true });
    } catch (err) {
        console.error('Mail error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};
