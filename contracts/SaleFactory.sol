pragma solidity 0.6.2;
import "./Sale.sol";
import "./XStarterStaking.sol";
import "./HasAdmin.sol";
contract SaleFactory is HasAdmin{
    uint256 salesAmount = 0;
    XStarterStaking xStarterStaking;
    mapping(address => bool) public saleCreators;
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
    constructor(address _admin, address _xStarterStaking) public HasAdmin(_admin){
        xStarterStaking = XStarterStaking(_xStarterStaking);
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
        returns (address)
    {
        require(saleCreators[msg.sender], "You don't have permission to create sales.");
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
    function setSaleCreator(address user, bool value) public onlyAdmin{
        saleCreators[user] = value;
    }
}