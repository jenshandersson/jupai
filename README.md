# Solana Portfolio Agent

An autonomous trading agent that manages a portfolio of SOL, BTC, and USDC on Solana using Jupiter DEX. The agent uses Claude AI to analyze technical indicators and market conditions to make trading decisions.

## Features

- 🤖 AI-powered trading decisions using Claude 3.5 Sonnet
- 📊 Technical analysis using price charts, moving averages, and StochRSI
- 💱 Automated trading execution via Jupiter DEX
- 📈 Performance tracking and risk metrics
- 📱 Trade notifications via Telegram
- 🔄 Portfolio rebalancing based on market conditions

## Architecture

- **Frontend**: Next.js dashboard showing portfolio performance, allocation, and risk metrics
- **Backend**: Next.js API routes handling trade execution and portfolio management
- **Storage**: Vercel KV for storing trade history and portfolio logs
- **Trading**: Jupiter DEX API for executing trades on Solana
- **Analysis**: Claude AI for technical analysis and trading decisions
- **Charts**: TradingView charts via chart-img.com API

## Setup

1. Clone the repository
2. Install dependencies:

To run the example locally you need to:

## Learn More

To learn more about OpenAI, Next.js, and the Vercel AI SDK take a look at the following resources:

- [Vercel AI SDK docs](https://sdk.vercel.ai/docs)
- [Vercel AI Playground](https://play.vercel.ai)
- [OpenAI Documentation](https://platform.openai.com/docs) - learn about OpenAI features and API.
- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
