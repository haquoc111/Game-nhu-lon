const express = require("express");
const axios = require("axios");

const app = express();

const PORT = process.env.PORT || 3000;

const API =
  "https://wtxmd52.tele68.com/v1/txmd5/lite-sessions?cp=R&cl=R&pf=web&at=62385f65eb49fcb34c72a7d6489ad91d";

let DATA = {
  phien: 0,
  ket_qua: "",
  xuc_xac: "",
  du_doan: "",
  do_tin_cay: "",
  cau_dang_chay: ""
};

// ======================
// TÀI / XỈU
// ======================
function taiXiu(total) {
  return total >= 11 ? "tài" : "xỉu";
}

// ======================
// LẤY CẦU
// ======================
function getCau(list, limit = 8) {
  return list
    .slice(0, limit)
    .map((i) => (i === "tài" ? "t" : "x"))
    .join("");
}

// ======================
// THUẬT TOÁN
// ======================
function predict(history) {
  let tai = 0;
  let xiu = 0;

  const recent = history.slice(0, 20);

  recent.forEach((i) => {
    if (i === "tài") tai++;
    else xiu++;
  });

  const cau4 = getCau(history, 4);

  // bẻ cầu
  if (cau4 === "tttt") {
    return {
      du_doan: "xỉu",
      do_tin_cay: "78%"
    };
  }

  if (cau4 === "xxxx") {
    return {
      du_doan: "tài",
      do_tin_cay: "78%"
    };
  }

  // theo xu hướng
  if (tai >= xiu) {
    return {
      du_doan: "tài",
      do_tin_cay: `${65 + Math.min(tai - xiu, 20)}%`
    };
  }

  return {
    du_doan: "xỉu",
    do_tin_cay: `${65 + Math.min(xiu - tai, 20)}%`
  };
}

// ======================
// UPDATE
// ======================
async function update() {
  try {
    const res = await axios.get(API, {
      timeout: 10000
    });

    // DEBUG
    console.log("RAW:", JSON.stringify(res.data).slice(0, 500));

    // Tìm mảng session
    let sessions = [];

    if (Array.isArray(res.data)) {
      sessions = res.data;
    } else if (Array.isArray(res.data.data)) {
      sessions = res.data.data;
    } else if (Array.isArray(res.data.sessions)) {
      sessions = res.data.sessions;
    } else if (Array.isArray(res.data.items)) {
      sessions = res.data.items;
    } else if (Array.isArray(res.data.list)) {
      sessions = res.data.list;
    }

    if (!sessions.length) {
      console.log("KHÔNG CÓ SESSION");
      return;
    }

    // phiên mới nhất
    const current = sessions[0];

    // lịch sử
    const history = [];

    for (const s of sessions) {
      let dice =
        s.dices ||
        s.dice ||
        s.result ||
        s.md5 ||
        [];

      if (!Array.isArray(dice)) continue;

      const d1 = Number(dice[0] || 0);
      const d2 = Number(dice[1] || 0);
      const d3 = Number(dice[2] || 0);

      const total = d1 + d2 + d3;

      history.push(taiXiu(total));
    }

    // xúc xắc phiên mới
    let dice =
      current.dices ||
      current.dice ||
      current.result ||
      [1, 1, 1];

    const d1 = Number(dice[0] || 1);
    const d2 = Number(dice[1] || 1);
    const d3 = Number(dice[2] || 1);

    const ket_qua = taiXiu(d1 + d2 + d3);

    const p = predict(history);

    DATA = {
      phien:
        current.session ||
        current.issue ||
        current.id ||
        Date.now(),

      ket_qua,

      xuc_xac: `${d1}-${d2}-${d3}`,

      du_doan: p.du_doan,

      do_tin_cay: p.do_tin_cay,

      cau_dang_chay: getCau(history)
    };

    console.log("UPDATED:", DATA);

  } catch (e) {
    console.log("ERROR:", e.message);
  }
}

// chạy ngay
update();

// cập nhật mỗi 5 giây
setInterval(update, 5000);

// ======================
// API
// ======================
app.get("/", (req, res) => {
  res.json(DATA);
});

app.get("/sessions", (req, res) => {
  res.json(DATA);
});

app.listen(PORT, () => {
  console.log("SERVER RUNNING PORT", PORT);
});