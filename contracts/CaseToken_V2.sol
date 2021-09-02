pragma solidity 0.6.2;

import "./XStarterToken.sol";

// MOCK TOKEN FOR UNIT TESTING
contract CaseToken_V2 is XStarterToken {
    function changeTokenData(
        string calldata newName,
        string calldata symbol,
        uint8 newDecimal
    ) external {
        _initialize(newName, symbol, newDecimal);
    }
}
