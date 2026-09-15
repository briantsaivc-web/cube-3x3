#!/bin/bash
# PreToolUse(Bash) hook：擋掉 AI 自行 git push／部署。exit 2 = 拒絕並回饋原因；exit 0 = 放行。
INPUT=$(cat)
if echo "$INPUT" | grep -Eq 'git push|gh-pages|netlify deploy|vercel deploy|surge '; then
  echo "【憲法第 6 節】push／部署必須由製作人本機執行。請把指令列在回報中，不要自己執行。" >&2
  exit 2
fi
exit 0
