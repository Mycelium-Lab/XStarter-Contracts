pragma solidity 0.6.2;

contract HasAdmin{
    address internal admin;
    constructor(address _admin) internal{
        admin = _admin;
    }
    modifier onlyAdmin {
        require(msg.sender == admin, "This function can be used only by admin.");
        _;
    }
    function changeAdmin(address _newAdmin) public onlyAdmin{
        admin = _newAdmin;
    }
}