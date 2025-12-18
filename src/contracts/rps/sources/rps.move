module ggc::ggc;

use sui::coin::{Self, Coin, TreasuryCap};
use sui::balance::{Self, Balance};
use sui::transfer;
use sui::tx_context::{Self, TxContext};
use sui::random::{Self, Random};
use sui::event;
use sui::object::{Self, UID};
use std::option::some;
use sui::url;
use sui::clock::{Self, Clock};
use sui::table::{Self, Table};

public struct GGC has drop {}

// Faucet for testing - mint GGC
const FAUCET_AMOUNT: u64 = 100_000_000_000; // 100 GGC
const FAUCET_MAX_PER_DAY: u64 = 5;
const FAUCET_MIN_INTERVAL_MS: u64 = 120_000; // 2 phút = 120,000 ms

// Errors
const E_INSUFFICIENT_POOL_BALANCE: u64 = 0;
const E_INVALID_BET_AMOUNT: u64 = 1;

// Constants
const MIN_BET: u64 = 10_000_000_000; // 10 GGC
const MAX_BET: u64 = 1_000_000_000_000; // 1000 GGC

// Choices
const KEO: u8 = 0;
const BUA: u8 = 1;
const BAO: u8 = 2;

// Faucet Data
public struct FaucetData has key {
    id: UID,
    claims: Table<address, FaucetClaim>,
}

public struct FaucetClaim has store, drop {
    last_claim_date: u64,     // Ngày cuối cùng claim (timestamp ngày, không giờ)
    daily_count: u64,         // Số lần claim trong ngày đó
    last_claim_timestamp: u64 // Timestamp lần claim cuối (để check interval 2 phút)
}

// Shared PoolData - hardcode ID in frontend, but struct here
public struct PoolData has key {
    id: UID,
    balance: Balance<GGC>,
}

// Event
public struct GameResult has copy, drop {
    player: address,
    bet_amount: u64,
    player_choice: u8,
    house_choice: u8,
    outcome: u8, // 0=thua, 1=thắng, 2=hòa
    payout: u64,
}

// Init - tạo pool
fun init(witness: GGC, ctx: &mut TxContext) {
    // Tạo currency GGC (nếu chưa có package coin riêng)
    let (treasury_cap, metadata) = coin::create_currency(
        witness,
        9,
        b"GGC",
        b"GitGud Coin",
        b"A crypto token for true gamers.",
        option::some(url::new_unsafe_from_bytes(b"https://red-glad-cuckoo-405.mypinata.cloud/ipfs/bafkreidjosuspzvdbcaf2xmo4m3qw3u5tpnvmvyudt3xwm5bwxt6lrus3u")),
        ctx
    );
    transfer::public_freeze_object(metadata);

    // Transfer TreasuryCap cho admin để mint sau
    transfer::public_transfer(treasury_cap, tx_context::sender(ctx));

    // Tạo Pool
    transfer::share_object(PoolData {
        id: object::new(ctx),
        balance: balance::zero<GGC>(),
    });

    // Tạo FaucetData
    transfer::share_object(FaucetData {
    id: object::new(ctx),
    claims: table::new(ctx),
    });
}

/// Player claim 100 GGC - giới hạn 5 lần/ngày, cách nhau ít nhất 2 phút
public entry fun claim_faucet(
    faucet: &mut FaucetData,
    cap: &mut TreasuryCap<GGC>,
    clock: &Clock,
    ctx: &mut TxContext
) {
    let player = tx_context::sender(ctx);
    let now_ms = clock::timestamp_ms(clock);

    // Tính ngày hiện tại (chỉ lấy ngày, bỏ giờ/phút/giây)
    let current_day = now_ms / 86_400_000; // 1 ngày = 86,400,000 ms

    // Nếu chưa có record thì tạo mới
    if (!table::contains(&faucet.claims, player)) {
        table::add(&mut faucet.claims, player, FaucetClaim {
            last_claim_date: 0,
            daily_count: 0,
            last_claim_timestamp: 0,
        });
    };

    let claim_record = table::borrow_mut(&mut faucet.claims, player);

    // Reset count nếu sang ngày mới
    if (claim_record.last_claim_date < current_day) {
        claim_record.daily_count = 0;
        claim_record.last_claim_date = current_day;
    };

    // Check giới hạn 5 lần/ngày
    assert!(claim_record.daily_count < FAUCET_MAX_PER_DAY, 1001);

    // Check khoảng cách 2 phút với lần claim trước
    assert!(now_ms - claim_record.last_claim_timestamp >= FAUCET_MIN_INTERVAL_MS, 1002);

    // Mint và transfer 100 GGC
    let coin = coin::mint(cap, FAUCET_AMOUNT, ctx);
    transfer::public_transfer(coin, player);

    // Update record
    claim_record.daily_count = claim_record.daily_count + 1;
    claim_record.last_claim_timestamp = now_ms;
}

// Admin deposit GGC vào pool
public entry fun deposit_to_pool(
    pool: &mut PoolData,
    cap: &mut TreasuryCap<GGC>,
    ctx: &mut TxContext
) {
    let deposit = coin::mint(cap, FAUCET_AMOUNT * 10, ctx);
    balance::join(&mut pool.balance, coin::into_balance(deposit));
}

// Main game - 1 tx auto
public entry fun play(
    pool: &mut PoolData,
    bet: Coin<GGC>,
    player_choice: u8,
    r: &Random,
    ctx: &mut TxContext
) {
    assert!(player_choice <= BAO, E_INVALID_BET_AMOUNT);

    let bet_amount = coin::value(&bet);
    assert!(bet_amount >= MIN_BET && bet_amount <= MAX_BET, E_INVALID_BET_AMOUNT);
    assert!(balance::value(&pool.balance) >= bet_amount, E_INSUFFICIENT_POOL_BALANCE); // Đủ cho hoàn trả hoặc payout

    let mut generator = random::new_generator(r, ctx);
    let house_choice = random::generate_u8_in_range(&mut generator, 0, 2);

    let player = tx_context::sender(ctx);

    let outcome = if (player_choice == house_choice) {
        2 // Hòa
    } else if (
        (player_choice == KEO && house_choice == BAO) ||
        (player_choice == BUA && house_choice == KEO) ||
        (player_choice == BAO && house_choice == BUA)
    ) {
        1 // Thắng
    } else {
        0 // Thua
    };

    if (outcome == 1) {
        // Thắng: payout 2x (gộp bet + reward từ pool)
        let reward_bal = balance::split(&mut pool.balance, bet_amount);
        let mut payout_coin = coin::from_balance(reward_bal, ctx);
        coin::join(&mut payout_coin, bet);
        transfer::public_transfer(payout_coin, player);
    } else if (outcome == 2) {
        // Hòa: hoàn trả bet
        transfer::public_transfer(bet, player);
    } else {
        // Thua: giữ bet vào pool
        balance::join(&mut pool.balance, coin::into_balance(bet));
    };

    event::emit(GameResult {
        player,
        bet_amount,
        player_choice,
        house_choice,
        outcome,
        payout: if (outcome == 1) bet_amount * 2 else if (outcome == 2) bet_amount else 0,
    });
}

// View balance pool
public fun pool_balance(pool: &PoolData): u64 {
    balance::value(&pool.balance)
}

// Mint GGC - chỉ admin gọi (dùng TreasuryCap)
public entry fun mint(
    cap: &mut TreasuryCap<GGC>,
    amount: u64,
    recipient: address,
    ctx: &mut TxContext
) {
    let minted = coin::mint(cap, amount, ctx);
    transfer::public_transfer(minted, recipient);
}

/*
Package ID: 
0xf1caab60fe49aab709bd076047d988468a556a79123bb774ffb608ac6d146ff4
Pool ID (shared object PoolData):
0xe9a96bbedbb2ad0f6e0a7647da00a312b6a2e20a544e2a2d78fba0167cc564ea
TreasuryCap ID (mint GGC): 
0xa5f583a7ebe42f6c33f0ac122db6552b47ed02f9f75b88261ae94774fedeb132
FaucetData ID: 
0x06a927a9e74b8472ee000347d88ecd377ea613ea03f16ba9c55619cf5f9f47b2

Mint 10,000 GGC to address:
sui client call --package 0xc7f8c585d839678b1494230f49379ecf7a88414d420d74fee06de5ced0594a42 --module ggc --function mint --args 0xedee3773b2ac3cf94c8903cc165103563569fa1120b12142494ec99343c59ebc 10000000000000 0x401e12050a7055fbede445774f00075233f70ba60c7499a5d712b38b977eea51 --gas-budget 10000000
*/