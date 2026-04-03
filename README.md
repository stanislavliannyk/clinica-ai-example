# Clinic AI Bot

Telegram-бот для клініки з інтеграцією LLM (GPT-4o-mini). Дозволяє пацієнтам записуватися до лікарів та отримувати відповіді на питання про клініку.

## Архітектура

```
src/
├── bot/                  — Telegraf Update-обробники та WizardScene запису
│   ├── bot.update.ts     — Основний обробник: /start, /help, /book, вхідні повідомлення
│   └── scenes/
│       └── booking.scene.ts  — 6-кроковий wizard запису до лікаря
├── llm/                  — Інтеграція з OpenAI
│   ├── llm.service.ts    — detectIntent, generateReply, detectSpecialty
│   └── prompts/          — Системні промпти для кожного випадку
├── crm/                  — Імітація CRM-системи (in-memory)
│   └── crm.service.ts    — Слоти лікарів, записи пацієнтів
├── appointments/         — Запис до лікаря (PostgreSQL)
│   ├── appointments.service.ts
│   └── appointment.entity.ts
├── patients/             — Пацієнти (PostgreSQL)
│   ├── patients.service.ts
│   └── patient.entity.ts
└── app.module.ts         — Кореневий модуль
```

## Потік розмови

1. Користувач надсилає повідомлення
2. `BotUpdate.onText` визначає намір через LLM (`detectIntent`)
3. Якщо `booking` — запускається `BookingScene` (WizardScene):
   - Крок 1: запит імені
   - Крок 2: валідація імені (мін. 2 слова)
   - Крок 3: запит та валідація телефону (+38XXXXXXXXXX)
   - Крок 4: опис скарги → LLM визначає спеціалізацію → показ слотів
   - Крок 5: вибір слоту → підтвердження
   - Крок 6: збереження запису в БД та CRM
4. Якщо `faq` — LLM генерує відповідь на основі інформації про клініку
5. Якщо `fallback` — стандартне повідомлення з підказками

## Запуск

### Необхідні умови

- Docker та Docker Compose
- Telegram Bot Token (отримати у [@BotFather](https://t.me/BotFather))
- OpenAI API Key

### Кроки

1. Клонувати репозиторій та перейти в папку проєкту

2. Скопіювати файл конфігурації:
   ```bash
   cp .env.example .env
   ```

3. Заповнити `.env`:
   ```
   TELEGRAM_BOT_TOKEN=your_token_here
   OPENAI_API_KEY=your_key_here
   ```

4. Запустити через Docker Compose:
   ```bash
   docker-compose up --build
   ```

### Локальна розробка

```bash
# Встановити залежності
npm install

# Запустити PostgreSQL окремо або через docker-compose
docker-compose up postgres -d

# Запустити бота в режимі розробки
npm run start:dev
```

### Swagger UI

Документація API доступна за адресою: `http://localhost:3000/api`

## Змінні середовища

| Змінна               | Опис                          | За замовчуванням |
|----------------------|-------------------------------|------------------|
| `TELEGRAM_BOT_TOKEN` | Токен Telegram бота           | —                |
| `OPENAI_API_KEY`     | Ключ OpenAI API               | —                |
| `OPENAI_MODEL`       | Модель OpenAI                 | `gpt-4o-mini`    |
| `DB_HOST`            | Хост PostgreSQL               | `localhost`      |
| `DB_PORT`            | Порт PostgreSQL               | `5432`           |
| `DB_NAME`            | Назва БД                      | `clinic_bot`     |
| `DB_USER`            | Користувач БД                 | `postgres`       |
| `DB_PASSWORD`        | Пароль БД                     | `postgres`       |
| `PORT`               | HTTP-порт додатку             | `3000`           |

## Технічний стек

- **Runtime**: Node.js 20, TypeScript 5
- **Framework**: NestJS 10
- **Telegram**: nestjs-telegraf + Telegraf 4.x
- **LLM**: OpenAI SDK (GPT-4o-mini)
- **База даних**: PostgreSQL 15 + TypeORM
- **Інфраструктура**: Docker, Docker Compose
