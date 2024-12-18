"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { Log } from "@/lib/portfolio";

// Move these constants to a config file
const COLORS = ["#00C49F", "#0088FE", "#FFBB28", "#FF8042"];
const walletAddress = process.env.NEXT_PUBLIC_SOLANA_WALLET_ADDRESS!;

// Move these utility functions to lib/utils/stats.ts or similar
const calculateDailyReturns = (logs: Log[]): { [key: string]: number[] } => {
  const dailyLogs: { [key: string]: Log } = {};

  // Get one log per day (last log of each day)
  logs.forEach((log) => {
    const date = new Date(log.time).toISOString().split("T")[0];
    dailyLogs[date] = log;
  });

  const dates = Object.keys(dailyLogs).sort();
  const returns = {
    portfolio: [] as number[],
    wBTC: [] as number[],
    wSOL: [] as number[],
  };

  // Calculate daily returns
  for (let i = 1; i < dates.length; i++) {
    const prevLog = dailyLogs[dates[i - 1]];
    const currentLog = dailyLogs[dates[i]];

    returns.portfolio.push((currentLog.total - prevLog.total) / prevLog.total);
    returns.wBTC.push(
      (parseFloat(currentLog.assets[2].price) -
        parseFloat(prevLog.assets[2].price)) /
        parseFloat(prevLog.assets[2].price)
    );
    returns.wSOL.push(
      (parseFloat(currentLog.assets[0].price) -
        parseFloat(prevLog.assets[0].price)) /
        parseFloat(prevLog.assets[0].price)
    );
  }

  return returns;
};

const calculateStandardDeviation = (returns: number[]): number => {
  const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
  const squaredDiffs = returns.map((val) => Math.pow(val - mean, 2));
  const variance =
    squaredDiffs.reduce((sum, val) => sum + val, 0) / returns.length;

  console.log({ variance, mean });
  // Annualize by multiplying by sqrt(365)
  return Math.sqrt(variance) * Math.sqrt(365);
};

const calculateSharpeRatio = (
  returns: number[],
  riskFreeRate: number = 0.05
): number => {
  const mean = returns.reduce((sum, val) => sum + val, 0) / returns.length;
  const annualizedReturn = (1 + mean) ** 365 - 1; // Annualize returns
  const stdDev = calculateStandardDeviation(returns);
  return (annualizedReturn - riskFreeRate) / stdDev;
};

const StatsPage = () => {
  const [data, setData] = useState<{ logs: Log[]; summary: string }>({
    logs: [],
    summary: "",
  });
  const [loading, setLoading] = useState(true);

  const logs = useMemo(
    () => data.logs.filter((l) => l.assets.length == 3),
    [data.logs]
  );

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch("/api/logs");
        const data = await response.json();
        setData(data);
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (logs.length === 0) {
    return <div>No data available</div>;
  }

  const latestLog = logs[logs.length - 1];
  const firstLog = logs[0];
  const value = latestLog.total;
  const performanceChange =
    ((latestLog.total - firstLog.total) / firstLog.total) * 100;

  const pieChartData = latestLog.assets.map((asset, index) => ({
    name: ["wSOL", "USDC", "WBTC"][index],
    value: (asset.value / value) * 100,
  }));

  // New code for percentage performance chart
  const percentagePerformanceData = logs.map((log) => {
    const totalPerformance =
      ((log.total - firstLog.total) / firstLog.total) * 100;
    const wbtcPerformance =
      ((parseFloat(log.assets[2].price) -
        parseFloat(firstLog.assets[2].price)) /
        parseFloat(firstLog.assets[2].price)) *
      100;
    const wsolPerformance =
      ((parseFloat(log.assets[0].price) -
        parseFloat(firstLog.assets[0].price)) /
        parseFloat(firstLog.assets[0].price)) *
      100;

    return {
      time: new Date(log.time).toLocaleDateString(),
      total: totalPerformance,
      wBTC: wbtcPerformance,
      wSOL: wsolPerformance,
    };
  });
  const percentageAllocationData = logs.map((log) => {
    return {
      time: new Date(log.time).toLocaleDateString(),
      USDC: (log.assets[1].value / log.total) * 100,
      wBTC: (log.assets[2].value / log.total) * 100,
      wSOL: (log.assets[0].value / log.total) * 100,
    };
  });

  const dailyReturns = calculateDailyReturns(logs);

  const riskMetrics = {
    portfolio: {
      stdDev: calculateStandardDeviation(dailyReturns.portfolio),
      sharpe: calculateSharpeRatio(dailyReturns.portfolio),
    },
    wBTC: {
      stdDev: calculateStandardDeviation(dailyReturns.wBTC),
      sharpe: calculateSharpeRatio(dailyReturns.wBTC),
    },
    wSOL: {
      stdDev: calculateStandardDeviation(dailyReturns.wSOL),
      sharpe: calculateSharpeRatio(dailyReturns.wSOL),
    },
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Solana Bot Stats</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Current Allocation</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ percent }) => `${(percent * 100).toFixed(1)}%`}
              >
                {pieChartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Legend formatter={(value) => value} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h2 className="text-xl font-semibold mb-2">Performance Stats</h2>
          <p className="text-lg">
            Current Value: ${latestLog.total.toFixed(2)}
          </p>
          <p className="text-lg">
            Performance Change: {performanceChange.toFixed(2)}%
          </p>
          <p className="text-lg">
            Start Date: {new Date(firstLog.time).toLocaleDateString()}
          </p>
          <p className="text-lg">
            Latest Date: {new Date(latestLog.time).toLocaleDateString()}
          </p>
          <div className="mt-4">
            <h3 className="text-lg font-semibold">Risk Metrics (Annualized)</h3>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <p className="font-medium">Portfolio:</p>
                <p>
                  Std Dev: {(riskMetrics.portfolio.stdDev * 100).toFixed(2)}%
                </p>
                <p>Sharpe: {riskMetrics.portfolio.sharpe.toFixed(2)}</p>
              </div>
              <div>
                <p className="font-medium">wBTC:</p>
                <p>Std Dev: {(riskMetrics.wBTC.stdDev * 100).toFixed(2)}%</p>
                <p>Sharpe: {riskMetrics.wBTC.sharpe.toFixed(2)}</p>
              </div>
              <div>
                <p className="font-medium">wSOL:</p>
                <p>Std Dev: {(riskMetrics.wSOL.stdDev * 100).toFixed(2)}%</p>
                <p>Sharpe: {riskMetrics.wSOL.sharpe.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <p className="text-lg mt-4 truncate">
            Wallet Address:{" "}
            <a
              href={`https://solscan.io/account/${walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {walletAddress}
            </a>
          </p>
          <h3 className="text-lg font-semibold mt-4">Latest Analysis</h3>
          <p>{data.summary}</p>
        </div>
      </div>

      {/* New chart for percentage performance */}
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">
          Percentage Performance Since Start
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={percentagePerformanceData}>
            <XAxis dataKey="time" />
            <YAxis unit="%" />
            <Tooltip formatter={(value: number) => `$${value.toFixed(2)}%`} />
            <Legend />
            <Line
              type="monotone"
              dataKey="total"
              stroke="#8884d8"
              name="Portfolio"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="wBTC"
              stroke="#FFBB28"
              name="wBTC"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="wSOL"
              stroke="#00C49F"
              name="wSOL"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white p-4 rounded shadow">
        <h2 className="text-xl font-semibold mb-2">
          Percentage Allocation Over Time
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={percentageAllocationData}>
            <XAxis dataKey="time" />
            <YAxis unit="%" />
            <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
            <Legend />
            <Line
              type="monotone"
              dataKey="USDC"
              stroke="#0088FE"
              name="USDC"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="wBTC"
              stroke="#FFBB28"
              name="wBTC"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="wSOL"
              stroke="#00C49F"
              name="wSOL"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsPage;
