pragma solidity 0.6.2;
import "./Sale.sol";
import "./XStarterStaking.sol";
contract SaleFactory{
    uint256 salesAmount = 0;
    address private admin;
    XStarterStaking xStarterStaking;
    event saleCreated(
        string tokenName, 
        address tokenAddress, 
        address tokenCreator, 
        uint256 softcap,
        uint256[] tiersMaxAmountValues,
        uint256 startTimestamp, 
        uint256 endTimestamp, 
        uint256 price,
        string  description,
        address saleAddress
        );
    constructor(address _admin, address _xStarterStaking) public {
        admin = _admin;
        xStarterStaking = XStarterStaking(_xStarterStaking);
    }
    modifier onlyAdmin {
        require(msg.sender == admin, "Only admin can create new sales!");
        _;
    }
    function createNewSale(
        string memory _tokenName, 
        address _tokenAddress, 
        address _tokenCreator, 
        uint256 _softcap,
        uint256[] memory _tiersMaxAmountValues,
        uint256 _startTimestamp, 
        uint256 _endTimestamp, 
        uint256 _price,
        string memory _description
    ) 
        public 
        onlyAdmin 
        returns (address)
    {
        Sale sale = new Sale(
            _tokenName, 
            _tokenAddress,
            _tokenCreator,
            _softcap, 
            _tiersMaxAmountValues, 
            _startTimestamp, 
            _endTimestamp, 
            _price, 
            _description, 
            admin,
            address(xStarterStaking)
        );
        emit saleCreated(
            _tokenName, 
            _tokenAddress,
            _tokenCreator,
            _softcap, 
            _tiersMaxAmountValues, 
            _startTimestamp, 
            _endTimestamp, 
            _price, 
            _description,
            address(sale)
            );
        return address(sale);
    }
}