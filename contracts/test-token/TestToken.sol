pragma solidity 0.6.2;

import "./TestERC20.sol";
import "@openzeppelin/contracts/proxy/Initializable.sol";

// MOCK TOKEN FOR UNIT TESTING
contract TestToken is TestERC20, Initializable {
     function initialize(address admin) public initializer {
        _initialize("Test Token", "TKN", 8);
        
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(MINTER_ROLE, admin);
    }

    function mint(address recipient, uint256 amount) public returns (bool) {
        require(hasRole(MINTER_ROLE, _msgSender()), "mint: unauthorized call!");

        _mint(recipient, amount);

        return true;
    }

    function burn(uint256 amount) public {
        _burn(_msgSender(), amount);
    }
}
