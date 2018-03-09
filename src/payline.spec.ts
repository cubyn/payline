import * as _debug from "debug";
import {sleep} from "30-seconds-of-code";

import { default as Payline } from "./payline";
import {Card, CURRENCIES, Environment, Payment} from "./model";

const debug = _debug("payline-test");

const merchantId: string = process.env.MERCHANT_ID || "XXX";
const accessKey: string = process.env.ACCESS_KEY || "XXX";
const contractId: string = process.env.CONTRACT_ID || "01234567";
const environment: Environment = Environment.homologation;

const startDate: Date = new Date();

const payline: Payline = new Payline(merchantId, accessKey, contractId, environment);
payline.defaultCurrency = CURRENCIES.EUR;

const generateCard = (): Card => {
    return {
        cardholder: "John Doe",
        number: "4242424242424242", // test valid card
        expirationDate: new Date(startDate.getTime() + 1000 * 60 * 60 * 24), // experied in 1 day
        cvx: "123",
        type: "CB",
    }
};

const generatePayment = (): Payment => {
    return {
        amount: 9743,
        softDescriptor: "payment test description"
    }
};

let card: Card = generateCard();
let payment: Payment = generatePayment();
let walletId: string = "TEST_" + payline.generateId();

// regenerate the data after each test
afterEach(() => {
    card = generateCard();
    payment = generatePayment();
    walletId = "TEST_" + payline.generateId();
});

describe("WALLET manipulation", () => {

    it("create wallet", async () => {
        const raw = await payline.createWallet(walletId, card);
        debug(`Create wallet response ${JSON.stringify(raw.raw)}`);
        expect(raw.wallet).toBe(walletId);
        expect(raw.raw.result && raw.raw.result.code).toBe("02500");
    });

    it("update wallet", async () => {
        const {wallet, ...rest} = await payline.createWallet(walletId, card);
        const updatedCard = Object.assign(card, {
            cvx: "124",
            expirationDate: new Date(startDate.getTime() + 1000 * 60 * 60 * 24 * 32), // experied in 1 month
            cardholder: "John Doe-Junior",
        });
        const raw = await payline.updateWallet(wallet, updatedCard);

        debug(`Update wallet response ${JSON.stringify(raw.raw)}`);
        expect(raw.wallet).toBe(walletId);
        expect(raw.raw.result && raw.raw.result.code).toBe("02500");
    });

    it("get wallet", async () => {
        const {wallet, ...rest} = await payline.createWallet(walletId, card);
        const raw = await payline.getWallet(wallet);
        debug(`Get wallet response ${JSON.stringify(raw.raw)}`);
        expect(raw.wallet).toBe(walletId);
        expect(raw.raw.result && raw.raw.result.code).toBe("02500");
        expect(raw.raw.wallet && raw.raw.wallet.card && raw.raw.wallet.card.expirationDate).toHaveLength(4);
        expect(raw.raw.wallet && raw.raw.wallet.card && raw.raw.wallet.card.number).toHaveLength(16);
        expect(raw.raw.wallet && raw.raw.wallet.card && raw.raw.wallet.card.number &&
            raw.raw.wallet.card.number.substring(10)).toBe("XX4242");
    });

    it("disable wallet", async () => {
        const {wallet, ...rest} = await payline.createWallet(walletId, card);
        const raw = await payline.disableWallet(wallet);
        debug(`Disable wallet response ${JSON.stringify(raw.raw)}`);
        expect(raw.success).toBe(true);
        expect(raw.raw.result && raw.raw.result.code).toBe("02500");
    });

});

describe("PAYMENT operations", () => {

    it("do wallet payment", async () => {
        const {wallet, ...rest} = await payline.createWallet(walletId, card);
        const raw = await payline.doWalletPayment(wallet, payment, "test_payment_name_");
        debug(`Do wallet payment response ${JSON.stringify(raw.raw)}`);
        //expect(raw.success).toBe(true);
        expect(raw.raw.result && raw.raw.result.code).toBe("00000");
        expect(raw.id).not.toBeUndefined();
    });

    it("do reset payment", async () => {
        const {wallet, ...rest} = await payline.createWallet(walletId, card);
        const {id, ...rest2} = await payline.doWalletPayment(wallet, payment, "test_payment_name_");
        const raw = await payline.doReset(id);

        debug(`Do reset payment response ${JSON.stringify(raw.raw)}`);
        //expect(raw.success).toBe(true);
        expect(raw.raw.result && raw.raw.result.code).toBe("00000");
        expect(raw.id).not.toBeUndefined();
    });

    it("schedule wallet payment", async () => {
        const {wallet, ...rest} = await payline.createWallet(walletId, card);
        const scheduleDate = new Date(startDate.getTime() + 1000 * 5); // in 5s
        const raw = await payline.scheduleWalletPayment(wallet, payment, scheduleDate, "test_schedule_payment_name_");

        debug(`Schedule wallet payment response ${JSON.stringify(raw.raw)}`);
        //expect(raw.success).toBe(true);
        expect(raw.raw.result && raw.raw.result.code).toBe("02500");
        expect(raw.id).not.toBeUndefined();
    });

});

describe("AUTHORIZATION operations", () => {

    it("do authorization", async () => {
        const raw = await payline.doAuthorization(payment, card, "test_authorization_name_");

        debug(`Do authorization response ${JSON.stringify(raw.raw)}`);
        //expect(raw.success).toBe(true);
        expect(raw.raw.result && raw.raw.result.code).toBe("00000");
        expect(raw.id).not.toBeUndefined();
    });

    it("do re authorization", async () => {
        const {id, ...rest} = await payline.doAuthorization(payment, card, "test_authorization_name_");
        const raw = await payline.doReAuthorization(id, payment, card, "test_re-authorization_name_");

        debug(`Do re authorization response ${JSON.stringify(raw.raw)}`);
        //expect(raw.success).toBe(true);
        expect(raw.raw.result && raw.raw.result.code).toBe("00000");
        expect(raw.id).not.toBeUndefined();
    });

    it("do capture", async () => {
        const {id, ...rest} = await payline.doAuthorization(payment, card, "test_authorization_name_");
        await payline.doReAuthorization(id, payment, card, "test_re-authorization_name_");
        const raw = await payline.doCapture(id, payment);

        debug(`Do capture response ${JSON.stringify(raw.raw)}`);
        //expect(raw.success).toBe(true);
        expect(raw.raw.result && raw.raw.result.code).toBe("00000");
        expect(raw.id).not.toBeUndefined();
    });

    it("do reset", async () => {
        const {id, ...rest} = await payline.doAuthorization(payment, card, "test_authorization_name_");
        await payline.doReAuthorization(id, payment, card, "test_re-authorization_name_");
        const raw = await payline.doReset(id);

        debug(`Do reset response ${JSON.stringify(raw.raw)}`);
        //expect(raw.success).toBe(true);
        expect(raw.raw.result && raw.raw.result.code).toBe("00000");
        expect(raw.id).not.toBeUndefined();
    });

});

describe("ADDITIONAL operations", () => {

    it("transaction details", async () => {
        const {id, ...rest} = await payline.doAuthorization(payment, card, "test_transaction_details_name_");
        const raw = await payline.transactionDetail(id);

        debug(`transaction details response ${JSON.stringify(raw.raw)}`);
        //expect(raw.success).toBe(true);
        expect(raw.raw.result && raw.raw.result.code).toBe("00000");
        expect(raw.id).not.toBeUndefined();
    });

    it("do refund", async () => {
        const {id, ...rest} = await payline.doAuthorization(payment, card, "test_refund_name_");
        await payline.doCapture(id, payment);
        const raw = await payline.doRefund(id, payment, "test_refund_name_");

        debug(`Do refund response ${JSON.stringify(raw.raw)}`);
        //expect(raw.success).toBe(true);
        expect(raw.raw.result && raw.raw.result.code).toBe("00000");
        expect(raw.id).not.toBeUndefined();
    });

    it("do web payment", async () => {
        const {id, ...rest} = await payline.doAuthorization(payment, card, "test_refund_name_");
        await payline.doCapture(id, payment);
        const raw = await payline.doWebPayment(payment, "https://example.com/success",
            "https://example.com/cancel", {}, null, "test_web_payment_name_");

        debug(`Do web payment response ${JSON.stringify(raw.raw)}`);
        //expect(raw.success).toBe(true);
        expect(raw.raw.result && raw.raw.result.code).toBe("00000");
        expect(raw.url).not.toBeUndefined();
    });


    it("validate card", async () => {
        const raw: any = await payline.validateCard(payment, card, "test_card_validation_name_");

        debug(`Validate card response ${JSON.stringify(raw.raw)}`);
        //expect(raw.success).toBe(true);
        expect(raw.raw.authorization.raw.result && raw.raw.authorization.raw.result.code).toBe("00000");
        expect(raw.raw.reset.raw.result && raw.raw.reset.raw.result.code).toBe("00000");
        expect(raw.raw.authorization.id).not.toBeUndefined();
        expect(raw.raw.reset.id).not.toBeUndefined();
    });

});
