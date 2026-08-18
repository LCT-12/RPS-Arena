module rps::gg_skin;

use sui::object::{Self, UID};
use sui::tx_context::{Self, TxContext};
use sui::transfer;
use sui::display;
use sui::package;
use std::string;
use sui::url;
use sui::coin::{Self, Coin};
use rps::ggc::GGC;

const ADMIN: address = @0xf213f26def1543419259b7e10776786b700311e28b7e35e6ad6567ac0027db37; 
const MINT_FEE: u64 = 150_000_000_000; 

// --- Error Constants ---
const EInsufficientPayment: u64 = 1;

public struct NFT has key, store {
    id: UID,
    name: string::String,
    description: string::String,
    image_url: url::Url,
    creator: address,
    gesture: string::String, 
}

public struct GG_SKIN has drop {}

fun init(otw: GG_SKIN, ctx: &mut TxContext) {
    let publisher = package::claim(otw, ctx);

    let keys = vector[
        string::utf8(b"name"),
        string::utf8(b"description"),
        string::utf8(b"image_url"),
        string::utf8(b"gesture"),
    ];

    let values = vector[
        string::utf8(b"{name}"),
        string::utf8(b"{description}"),
        string::utf8(b"{image_url}"),
        string::utf8(b"{gesture}"),
    ];

    let mut display = display::new_with_fields<NFT>(
        &publisher,
        keys,
        values,
        ctx
    );

    display::update_version(&mut display);

    transfer::public_transfer(publisher, ctx.sender());
    transfer::public_transfer(display, ctx.sender());
}

public fun mint_nft(
    name: vector<u8>,
    description: vector<u8>,
    image_url: vector<u8>,
    gesture: vector<u8>,
    mut payment: Coin<GGC>,
    ctx: &mut TxContext
) {
    let sender = ctx.sender();

    if (sender != ADMIN) {
        assert!(coin::value(&payment) >= MINT_FEE, EInsufficientPayment);
        let fee_coin = coin::split(&mut payment, MINT_FEE, ctx);
        transfer::public_transfer(fee_coin, ADMIN);
    };

    transfer::public_transfer(payment, sender);

    let nft = NFT {
        id: object::new(ctx),
        name: string::utf8(name),
        description: string::utf8(description),
        image_url: url::new_unsafe_from_bytes(image_url),
        creator: sender,
        gesture: string::utf8(gesture),
    };

    transfer::public_transfer(nft, sender);
}