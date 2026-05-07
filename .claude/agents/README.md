# צוות הסוכנים של מחליפון

## מי להפעיל ומתי

| סוכן | מתי להשתמש |
|---|---|
| **`team-lead`** | **תמיד ראשון** לפיצ'ר שנוגע בכמה שכבות. הוא יאציל לשאר. |
| **`feature-planner`** | לפני כל פיצ'ר חדש — ממפה DB + API + UI + UX עברי |
| `sql-pro` | שינויי סכמה, שאילתות מורכבות, PostgreSQL 15 |
| `backend-developer` | Routes חדשים, לוגיקה עסקית, middleware |
| `react-specialist` | קומפוננטות, hooks, React Query, RTL |
| `api-designer` | עיצוב endpoints, OpenAPI docs |
| `typescript-pro` | טיפוסים מורכבים, generics, Zod inference |
| `security-engineer` | auth, הרשאות, בדיקת חשיפת מידע בין רשויות |
| `code-reviewer` | בדיקת קוד לפני merge — כולל checklist ייעודי למחליפון |
| `deployment-engineer` | Railway, Vercel, env vars, migrations |
| `debugger` | תקלות, stack traces, בעיות JWT/CORS/DB |
| `qa-expert` | תכנון בדיקות ידניות, תרחישי QA לכל 3 תפקידים |

## זרימת עבודה מומלצת לפיצ'ר חדש

```
1. feature-planner  → תכנון מלא (DB + API + UI)
2. sql-pro          → שינויי סכמה + migration
3. backend-developer → routes + לוגיקה
4. react-specialist  → UI + RTL + עברית
5. code-reviewer     → בדיקת קוד
6. qa-expert         → תרחישי בדיקה ידניים
```

## כללי ברזל לכל הסוכנים

- **UUID בלבד** — אסור IDs מספריים
- **SQL מפורמט** — אסור חיבור מחרוזות
- **עברית** — כל טקסט למשתמש בעברית
- **RTL** — layout ימין-לשמאל תמיד
- **asyncHandler** — כל route handler בשרת
- **AppError** — לכל שגיאה צפויה בשרת
- **Lucide React בלבד** — אסור ספריות אייקונים אחרות
- **navy/mint/sky** — אסור צבעים שרירותיים ב-Tailwind
