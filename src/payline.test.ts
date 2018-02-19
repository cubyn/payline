import { default as Payline } from "./payline";
import {Card, Environment} from "./model";

const merchantId: string = process.env.MERCHANT_ID || "XXX";
const accessKey: string = process.env.ACCESS_KEY || "XXX";
const contractId: string = process.env.MERCHANT_ID || "1234567";
const enviromnent: Environment = Environment.homologation;

const startDate: Date = new Date();

const payline: Payline = new Payline(merchantId, accessKey, contractId, enviromnent);

const createWalletTest = async () => {
    const walletId: string = payline.generateId();
    const card: Card = {
        cardholder: "John Doe",
        number: "4242424242424242", // test valid card
        expirationDate: new Date(startDate.getDate() + 1000 * 60 * 60 * 24), // experied in 1 day
        cvx: "123",
    };
    const createWalletDate: Date = new Date();
    const createWallet = await payline.createWallet(walletId, card);
    console.log(`Create wallet response ${JSON.stringify(createWallet)} in ${new Date().getDate() - createWalletDate.getDate()}ms`);
    return createWallet;
};

const test = async () => {
    const createWallet = await createWalletTest();

};

test().then(() => {
    console.log(`TEST finished in ${new Date().getDate() - startDate.getDate()}ms`);
});
