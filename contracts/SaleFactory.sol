pragma solidity 0.6.2;
import "./Sale.sol";
import "./XStarterStaking.sol";
contract SaleFactory{
    uint256 salesAmount = 0;
    address private admin;
    XStarterStaking caseStaking;
    event saleCreated(
        string tokenName, 
        address tokenAddress, 
        address tokenCreator, 
        uint256 minAmount,
        uint256[] tiersMaxAmountValues,
        uint256 startTimestamp, 
        uint256 endTimestamp, 
        uint256 price,
        string  description,
        address saleAddress
        );
    constructor(address _admin, address _caseStaking) public {
        admin = _admin;
        caseStaking = XStarterStaking(_caseStaking);
    }
    modifier onlyAdmin {
        require(msg.sender == admin, "Only admin can create new sales!");
        _;
    }
    function createNewSale(
        string memory _tokenName, 
        address _tokenAddress, 
        address _tokenCreator, 
        uint256 _minAmount,
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
            _minAmount, 
            _tiersMaxAmountValues, 
            _startTimestamp, 
            _endTimestamp, 
            _price, 
            _description, 
            admin,
            address(caseStaking)
        );
        emit saleCreated(
            _tokenName, 
            _tokenAddress,
            _tokenCreator,
            _minAmount, 
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