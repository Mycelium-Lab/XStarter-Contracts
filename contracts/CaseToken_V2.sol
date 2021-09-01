pragma solidity 0.6.2;

import "./Xstarter.sol";

// MOCK TOKEN FOR UNIT TESTING
contract CaseToken_V2 is Xstarter {
    function changeTokenData(
        string calldata newName,
        string calldata symbol,
        uint8 newDecimal
    ) external {
        _initialize(newName, symbol, newDecimal);
    }
}
