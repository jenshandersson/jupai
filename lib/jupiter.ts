import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import bs58 from "bs58";
import {
  createJupiterApiClient,
  QuoteGetRequest,
  QuoteResponse,
} from "@jup-ag/api";
import { getSignature } from "./utils/getSignature";
import { transactionSenderAndConfirmationWaiter } from "./utils/transactionSender";

const jupiterQuoteApi = createJupiterApiClient(); // config is optional

const connection = new Connection(process.env.SOLANA_RPC_URL!);

async function getSwapObj(wallet: Wallet, quote: QuoteResponse) {
  // Get serialized transaction
  const swapObj = await jupiterQuoteApi.swapPost({
    swapRequest: {
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toBase58(),
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
      wrapAndUnwrapSol: false,
    },
  });
  return swapObj;
}

export async function jupiterSwap(
  fromTokenAddress: string,
  toTokenAddress: string,
  amount: number,
  execute = false
) {
  if (!process.env.SOLANA_KEY) {
    throw Error("Missing key");
  }

  const wallet = new Wallet(
    Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_KEY))
  );

  const params: QuoteGetRequest = {
    inputMint: fromTokenAddress,
    outputMint: toTokenAddress,
    amount,
    slippageBps: 150,
    onlyDirectRoutes: false,
    asLegacyTransaction: false,
    // autoSlippage: true,
    // maxAutoSlippageBps: 100, // 1%
  };

  // get quote
  const quote = await jupiterQuoteApi.quoteGet(params);

  if (!quote) {
    throw new Error("unable to quote");
  }

  console.dir(quote, { depth: null });
  const swapObj = await getSwapObj(wallet, quote);
  console.dir(swapObj, { depth: null });

  // Serialize the transaction
  const swapTransactionBuf = Buffer.from(swapObj.swapTransaction, "base64");
  var transaction = VersionedTransaction.deserialize(swapTransactionBuf);

  // Sign the transaction
  transaction.sign([wallet.payer]);
  const signature = getSignature(transaction);

  // We first simulate whether the transaction would be successful
  const { value: simulatedTransactionResponse } =
    await connection.simulateTransaction(transaction, {
      replaceRecentBlockhash: true,
      commitment: "processed",
    });
  const { err, logs } = simulatedTransactionResponse;

  if (err) {
    // Simulation error, we can check the logs for more details
    // If you are getting an invalid account error, make sure that you have the input mint account to actually swap from.
    console.error("Simulation Error:");
    console.error({ err, logs });
    return { status: "Simulation failed", err, logs };
  }

  if (!execute) {
    return { status: "Simulation only" };
  }

  const serializedTransaction = Buffer.from(transaction.serialize());
  const blockhash = transaction.message.recentBlockhash;

  const transactionResponse = await transactionSenderAndConfirmationWaiter({
    connection,
    serializedTransaction,
    blockhashWithExpiryBlockHeight: {
      blockhash,
      lastValidBlockHeight: swapObj.lastValidBlockHeight,
    },
  });

  // If we are not getting a response back, the transaction has not confirmed.
  if (!transactionResponse) {
    throw Error("Not confirmed");
  }

  if (transactionResponse.meta?.err) {
    console.error(transactionResponse.meta?.err);
  }

  console.log(`https://solscan.io/tx/${signature}`);

  return {
    status: "Success",
    url: `https://solscan.io/tx/${signature}`,
  };
}

// async function limitOrdersTest() {
//   const openOrders = await limitOrder.getOrders([
//     ownerFilter(wallet.publicKey),
//   ]);
//   console.log(wallet.publicKey);

//   const orderHistory: OrderHistoryItem[] = await limitOrder.getOrderHistory({
//     wallet: wallet.publicKey.toBase58(),
//     take: 20, // optional, default is 20, maximum is 100
//     // lastCursor: order.id // optional, for pagination
//   });

//   console.dir(openOrders, { depth: null });
//   console.dir(orderHistory, { depth: null });
// }
