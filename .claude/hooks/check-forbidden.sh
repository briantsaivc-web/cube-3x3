#!/bin/bash
# PostToolUse(Edit|Write) hook：engine 層出現非確定性來源或 DOM 依賴就立即回饋。
# 檢查 src/engine/ 與 src/solver/（本案 2026-09-15 起）；其他目錄不擋。
# 既有程式碼若已有合理例外，把該行的「檔案:行內容片段」加進 .claude/hooks/forbidden-allowlist.txt（每行一個 grep 片段）。
if [ -d src/engine ] || [ -d src/solver ]; then
  HITS=$(grep -RnE 'Math\.random|Date\.now|new Date\(|performance\.now|localStorage|sessionStorage|document\.|window\.|navigator\.|fetch\(|setTimeout|setInterval|requestAnimationFrame' src/engine src/solver 2>/dev/null)
  if [ -s .claude/hooks/forbidden-allowlist.txt ]; then
    HITS=$(echo "$HITS" | grep -v -F -f .claude/hooks/forbidden-allowlist.txt)
  fi
  if [ -n "$HITS" ]; then
    echo "【憲法第 3 節】src/engine/ 或 src/solver/ 內發現非確定性來源或 DOM／計時器依賴，請改用 seeded RNG 或由 action／state 傳入：" >&2
    echo "$HITS" | head -20 >&2
    exit 2
  fi
fi
exit 0
