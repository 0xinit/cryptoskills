// StarkNet Cairo Starter Contract
// Includes: storage, events, interface, access control, ERC-20-like pattern
//
// Usage:
//   1. Copy this file to src/lib.cairo in a new Scarb project
//   2. Update Scarb.toml with starknet dependency
//   3. scarb build && snforge test

#[starknet::interface]
pub trait IToken<TContractState> {
    fn name(self: @TContractState) -> ByteArray;
    fn symbol(self: @TContractState) -> ByteArray;
    fn decimals(self: @TContractState) -> u8;
    fn total_supply(self: @TContractState) -> u256;
    fn balance_of(self: @TContractState, account: ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: ContractAddress, spender: ContractAddress) -> u256;
    fn transfer(ref self: TContractState, to: ContractAddress, amount: u256) -> bool;
    fn transfer_from(
        ref self: TContractState, from: ContractAddress, to: ContractAddress, amount: u256,
    ) -> bool;
    fn approve(ref self: TContractState, spender: ContractAddress, amount: u256) -> bool;
    fn mint(ref self: TContractState, to: ContractAddress, amount: u256);
}

use starknet::ContractAddress;

#[starknet::contract]
pub mod Token {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        name: ByteArray,
        symbol: ByteArray,
        decimals: u8,
        total_supply: u256,
        balances: Map<ContractAddress, u256>,
        // (owner, spender) -> allowance
        allowances: Map<(ContractAddress, ContractAddress), u256>,
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Transfer: Transfer,
        Approval: Approval,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Transfer {
        #[key]
        pub from: ContractAddress,
        #[key]
        pub to: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Approval {
        #[key]
        pub owner: ContractAddress,
        #[key]
        pub spender: ContractAddress,
        pub amount: u256,
    }

    mod Errors {
        pub const ZERO_ADDRESS: felt252 = 'Transfer to zero address';
        pub const INSUFFICIENT_BALANCE: felt252 = 'Insufficient balance';
        pub const INSUFFICIENT_ALLOWANCE: felt252 = 'Insufficient allowance';
        pub const NOT_OWNER: felt252 = 'Caller is not the owner';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        name: ByteArray,
        symbol: ByteArray,
        initial_supply: u256,
        owner: ContractAddress,
    ) {
        assert(owner.is_non_zero(), 'Owner is zero address');
        self.name.write(name);
        self.symbol.write(symbol);
        self.decimals.write(18);
        self.owner.write(owner);

        if initial_supply > 0 {
            self._mint(owner, initial_supply);
        }
    }

    #[abi(embed_v0)]
    impl TokenImpl of super::IToken<ContractState> {
        fn name(self: @ContractState) -> ByteArray {
            self.name.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.symbol.read()
        }

        fn decimals(self: @ContractState) -> u8 {
            self.decimals.read()
        }

        fn total_supply(self: @ContractState) -> u256 {
            self.total_supply.read()
        }

        fn balance_of(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.read(account)
        }

        fn allowance(
            self: @ContractState, owner: ContractAddress, spender: ContractAddress,
        ) -> u256 {
            self.allowances.read((owner, spender))
        }

        fn transfer(ref self: ContractState, to: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            self._transfer(caller, to, amount);
            true
        }

        fn transfer_from(
            ref self: ContractState, from: ContractAddress, to: ContractAddress, amount: u256,
        ) -> bool {
            let caller = get_caller_address();
            let current_allowance = self.allowances.read((from, caller));
            assert(current_allowance >= amount, Errors::INSUFFICIENT_ALLOWANCE);
            self.allowances.write((from, caller), current_allowance - amount);
            self._transfer(from, to, amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let owner = get_caller_address();
            assert(spender.is_non_zero(), Errors::ZERO_ADDRESS);
            self.allowances.write((owner, spender), amount);
            self.emit(Approval { owner, spender, amount });
            true
        }

        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            assert(get_caller_address() == self.owner.read(), Errors::NOT_OWNER);
            self._mint(to, amount);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _transfer(
            ref self: ContractState, from: ContractAddress, to: ContractAddress, amount: u256,
        ) {
            assert(to.is_non_zero(), Errors::ZERO_ADDRESS);
            let sender_balance = self.balances.read(from);
            assert(sender_balance >= amount, Errors::INSUFFICIENT_BALANCE);
            self.balances.write(from, sender_balance - amount);
            self.balances.write(to, self.balances.read(to) + amount);
            self.emit(Transfer { from, to, amount });
        }

        fn _mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            assert(to.is_non_zero(), Errors::ZERO_ADDRESS);
            self.total_supply.write(self.total_supply.read() + amount);
            self.balances.write(to, self.balances.read(to) + amount);
            self
                .emit(
                    Transfer { from: core::num::traits::Zero::zero(), to, amount },
                );
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{Token, ITokenDispatcher, ITokenDispatcherTrait};
    use snforge_std::{
        declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
        stop_cheat_caller_address,
    };
    use starknet::contract_address_const;

    fn deploy() -> ITokenDispatcher {
        let contract = declare("Token").unwrap().contract_class();
        let owner = contract_address_const::<0x1>();
        let mut calldata: Array<felt252> = array![];
        // ByteArray serialization for "Test Token"
        calldata.append(0); // pending_word_len for first chunk
        calldata.append('Test Token');
        calldata.append(10); // byte length
        // ByteArray serialization for "TST"
        calldata.append(0);
        calldata.append('TST');
        calldata.append(3);
        // initial_supply: u256 (low, high)
        calldata.append(1000000000000000000000); // 1000 * 10^18 low
        calldata.append(0); // high
        // owner
        calldata.append(owner.into());
        let (address, _) = contract.deploy(@calldata).unwrap();
        ITokenDispatcher { contract_address: address }
    }

    #[test]
    fn test_initial_supply() {
        let token = deploy();
        let owner = contract_address_const::<0x1>();
        let balance = token.balance_of(owner);
        assert(balance == 1000000000000000000000, 'Wrong initial balance');
    }

    #[test]
    fn test_transfer() {
        let token = deploy();
        let owner = contract_address_const::<0x1>();
        let recipient = contract_address_const::<0x2>();

        start_cheat_caller_address(token.contract_address, owner);
        token.transfer(recipient, 100);
        stop_cheat_caller_address(token.contract_address);

        assert(token.balance_of(recipient) == 100, 'Transfer failed');
    }

    #[test]
    #[should_panic(expected: 'Insufficient balance')]
    fn test_transfer_insufficient() {
        let token = deploy();
        let broke = contract_address_const::<0x3>();

        start_cheat_caller_address(token.contract_address, broke);
        token.transfer(contract_address_const::<0x4>(), 1);
    }
}
