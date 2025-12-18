/// Module: ggc
/// GitGud Coin - GGC + Game logic
module ggc::ggc {
    use std::option;
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url::{Self};
    use sui::object::{Self, UID};
    use sui::balance::{Self, Balance};

    /// One-Time Witness
    public struct GGC has drop {}

    /// Shared Pool
    public struct Pool has key {
        id: UID,
        balance: Balance<GGC>
    }

    /// AdminCap
    public struct AdminCap has key { 
        id: UID 
    }

    /// Init: Tạo coin + Pool + AdminCap
    fun init(witness: GGC, ctx: &mut TxContext) {
        // Tạo currency GGC
        let (treasury_cap, metadata) = coin::create_currency(
            witness,
            9,
            b"GGC",
            b"GitGud Coin",
            b"A cryptocurrency for true gamers - Git Gud or Get Rekt",
            option::some(url::new_unsafe_from_bytes(b"https://red-glad-cuckoo-405.mypinata.cloud/ipfs/bafybeieb74a336h3q36fitufuaeg77tqf4ts5cjbiazumjjvyhjqs7ca6e")),
            ctx
        );
        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));

        // Tạo Pool shared
        transfer::share_object(Pool {
            id: object::new(ctx),
            balance: balance::zero<GGC>()
        });

        // Tạo AdminCap
        transfer::transfer(AdminCap { id: object::new(ctx) }, tx_context::sender(ctx));
    }

    /// Mint - chỉ admin
    public entry fun mint(treasury: &mut TreasuryCap<GGC>, amount: u64, recipient: address, ctx: &mut TxContext) {
        let coin = coin::mint(treasury, amount, ctx);
        transfer::public_transfer(coin, recipient);
    }

    /// Deposit reserve - chỉ admin
    public entry fun deposit_reserve(pool: &mut Pool, reserve: Coin<GGC>, _cap: &AdminCap, _ctx: &mut TxContext) {
        balance::join(&mut pool.balance, coin::into_balance(reserve));
    }

    /// Bet 10 GGC
    public entry fun bet(pool: &mut Pool, payment: Coin<GGC>, _ctx: &mut TxContext) {
        assert!(coin::value(&payment) == 10_000_000_000, 1001);
        balance::join(&mut pool.balance, coin::into_balance(payment));
    }

    /// Payout 20 GGC
    public entry fun payout(pool: &mut Pool, treasury: &mut TreasuryCap<GGC>, winner: address, ctx: &mut TxContext) {
        let payout_amount: u64 = 20_000_000_000;

        if (balance::value(&pool.balance) < payout_amount) {
            let missing = payout_amount - balance::value(&pool.balance);
            let minted = coin::mint(treasury, missing, ctx);
            balance::join(&mut pool.balance, coin::into_balance(minted));
        };

        let payout_bal = balance::split(&mut pool.balance, payout_amount);
        let payout_coin = coin::from_balance(payout_bal, ctx);
        transfer::public_transfer(payout_coin, winner);
    }

    /// Read balance
    public fun get_pool_balance(pool: &Pool): u64 {
        balance::value(&pool.balance)
    }
}
/*
Package ID: 
0xaed048371a914964240dac80f59a062a5b8cf591d7ee5a92b55ed217e714489
Object ID:
0xa069b707a0c37b7bc9d93f350e31372cfcd4f502e96a1a1091fb8a7939d35fd9
Coin type: 
0xaed048371a914964240dac80f59a062a5b8cf591d7ee5a92b55ed217e714489::ggc::GGC
Pool ID (shared object): 
0x904c1552f93b6290f6a62f1b95bafab7072f422a2f71342e1f17a8c389e615f1
TreasuryCap ID: 
0x1853eee862ad9daaed2060faba7f1c6faafc4c0753676ad515da67bd2d634f5e
AdminCap ID: 
0x86ff03d5026b14363a975ba5273dde0bfbb62c366abe47def8dec4487b9598c8
Mint coin Player:
sui client call --package 0xaed048371a914964240dac80f59a062a5b8cf591d7ee5a92b55ed217e714489 --module ggc --function mint --args 0x1853eee862ad9daaed2060faba7f1c6faafc4c0753676ad515da67bd2d634f5e 100000000000 0x7221afae8e779f679c83c83abc9e235ea63fd6d349af14dd1fcb3ba18db5fcc8 --gas-budget 10000000
*/