module rps::rps;

use sui::coin::{Self, Coin};
use sui::balance::{Self, Balance};
use sui::sui::SUI;
use sui::random::{Self, Random};
use sui::event;

// Errors
const E_INSUFFICIENT_HOUSE_BALANCE: u64 = 0;
const E_INVALID_BET_AMOUNT: u64 = 1;
const E_NOT_AUTHORIZED: u64 = 2;

// Constants
const HOUSE_FEE_PERCENT: u64 = 2; // 2% house fee
const MIN_BET: u64 = 1_000_000; // 0.001 SUI
const MAX_BET: u64 = 1_000_000_000; // 1 SUI

// Shared object - holds house funds
public struct HouseData has key {
    id: UID,
    balance: Balance<SUI>,
    house: address,
    fees_collected: u64,
}

// Events
public struct GameResult has copy, drop {
    player: address,
    bet_amount: u64,
    player_won: bool,
    payout: u64,
}

// Initialize house (called once during publish)
fun init(ctx: &mut TxContext) {
    let house_data = HouseData {
        id: object::new(ctx),
        balance: balance::zero(),
        house: @0xe4b2d21e687c91f6efbbca58a2be1680d9486bccd4ed892f1b2040ba4cc38a89,
        fees_collected: 0,
    };
    transfer::share_object(house_data);
}


// House deposits funds to back bets
public entry fun deposit_to_house(
    house_data: &mut HouseData,
    deposit: Coin<SUI>,
    ctx: &TxContext
) {
    assert!(ctx.sender() == house_data.house, E_NOT_AUTHORIZED);
    let amount = coin::value(&deposit);
    balance::join(&mut house_data.balance, coin::into_balance(deposit));
}

// Main game function - user only approves ONCE when calling this
public entry fun play_game(
    house_data: &mut HouseData,
    bet: Coin<SUI>,
    guess: bool, // true = heads, false = tails
    r: &Random,
    ctx: &mut TxContext
) {
    let bet_amount = coin::value(&bet);
    
    // Validate bet
    assert!(bet_amount >= MIN_BET && bet_amount <= MAX_BET, E_INVALID_BET_AMOUNT);
    assert!(balance::value(&house_data.balance) >= bet_amount * 2, E_INSUFFICIENT_HOUSE_BALANCE);

    // Generate random outcome
    let mut generator = random::new_generator(r, ctx);
    let coin_flip = random::generate_bool(&mut generator);

    let player = ctx.sender();
    
    if (coin_flip == guess) {
        // Player wins - pays out automatically
        win_game(house_data, bet, player, ctx);
    } else {
        // Player loses - house keeps bet automatically
        lose_game(house_data, bet);
    };
}

// Internal function - player wins (called automatically)
fun win_game(
    house_data: &mut HouseData,
    bet: Coin<SUI>,
    player: address,
    ctx: &mut TxContext
) {
    let bet_amount = coin::value(&bet);
    
    // Calculate winnings (2x bet minus fee)
    let total_payout = bet_amount * 2;
    let fee = (total_payout * HOUSE_FEE_PERCENT) / 100;
    let player_payout = total_payout - fee;

    // Take payout from house balance
    let house_payout_balance = balance::split(&mut house_data.balance, player_payout - bet_amount);
    let mut house_payout = coin::from_balance(house_payout_balance, ctx);

    // Combine with original bet
    coin::join(&mut house_payout, bet);
    
    // Transfer to player automatically
    transfer::public_transfer(house_payout, player);
    
    house_data.fees_collected = house_data.fees_collected + fee;

    event::emit(GameResult {
        player,
        bet_amount,
        player_won: true,
        payout: player_payout,
    });
}

// Internal function - player loses (called automatically)
fun lose_game(
    house_data: &mut HouseData,
    bet: Coin<SUI>,
) {
    let bet_amount = coin::value(&bet);
    
    // Take fee from bet
    let fee = (bet_amount * HOUSE_FEE_PERCENT) / 100;
    house_data.fees_collected = house_data.fees_collected + fee;
    
    // Add entire bet to house balance
    balance::join(&mut house_data.balance, coin::into_balance(bet));

    event::emit(GameResult {
        player: @0x0, // Will be filled by transaction sender
        bet_amount,
        player_won: false,
        payout: 0,
    });
}

// House withdraws profits
public entry fun withdraw_fees(
    house_data: &mut HouseData,
    amount: u64,
    ctx: &mut TxContext
) {
    assert!(ctx.sender() == house_data.house, E_NOT_AUTHORIZED);
    let withdrawn = coin::take(&mut house_data.balance, amount, ctx);
    transfer::public_transfer(withdrawn, house_data.house);
}

// View functions
public fun house_balance(house_data: &HouseData): u64 {
    balance::value(&house_data.balance)
}

public fun fees_collected(house_data: &HouseData): u64 {
    house_data.fees_collected
}

