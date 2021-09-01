pragma solidity 0.6.2;
import "./CaseStaking.sol";
import "./ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
contract Sale{
    using SafeMath for uint256;
    using SafeERC20 for ERC20;
    
    ERC20 erc20Token;
    CaseStaking caseStaking;
    address admin;
    address tokenCreator;
    mapping(address => uint256) balances;
     
     
    string public tokenName;
    address public tokenAddress;
    uint256 public softcap;
    uint256[] public tiersMaxAmountValues;
    uint256 public startTimestamp;
    uint256 public endTimestamp;
    uint256 public price;
    string public description;
    mapping(address => uint256) public tokenBalances;
    uint256 public totalTokensSold;
   
    event tokensSold(
        address buyer,
        uint256 amount,
        uint256 pricePaid
        );
    event fundsWithdrawn(
        address sender,
        uint256 amount,
        uint256 newTokenBalance
        );
    event tokensWithdrawn(
        address sender,
        uint256 amount
        );
    modifier onlyAdmin {
        require(msg.sender == admin, "Only admin can create new sales!");
        _;
    }
    constructor(
        string memory _tokenName, 
        address _tokenAddress, 
        address _tokenCreator, 
        uint256 _softcap,
        uint256[] memory _tiersMaxAmountValues,
        uint256 _startTimestamp, 
        uint256 _endTimestamp, 
        uint256 _price,
        string memory _description,
        address _admin,
        address _caseStaking
    )
        public
    {
        require(_startTimestamp < _endTimestamp && now < _endTimestamp, "Invalid timestamp values.");
        tokenAddress = _tokenAddress;
        erc20Token = ERC20(_tokenAddress);
        tokenName = _tokenName;
        tokenCreator = _tokenCreator;
        softcap = _softcap;
        tiersMaxAmountValues = _tiersMaxAmountValues;
        startTimestamp = _startTimestamp;
        endTimestamp = _endTimestamp;
        price = _price;
        description = _description;
        admin = _admin;
        caseStaking = CaseStaking(_caseStaking);
    }
    function changePrice(uint256 newPrice) public onlyAdmin{
        require(now < startTimestamp, "Sale has already started.");
        require(newPrice > 0);
        price = newPrice;
    }
    function getCustomerTier(address customer) internal view returns (uint256){
        return caseStaking.userTiers(customer);
    }
    function isSaleActive() public view returns (bool){
        return now > startTimestamp && now < endTimestamp;
    }
    function hasSaleEnded() public view returns (bool){
        return now > endTimestamp;
    }
    function getCurrentTimestamp() public view returns (uint256){
        return now;
    }
    function withdrawFunds(uint256 amount) public {
        require(balances[msg.sender] >= amount, "You didn't participate in sale.");
        require(now < startTimestamp || now > endTimestamp, "You can't withdraw when sale is in progress");
        require(totalTokensSold < softcap, "You can't withdraw because sale reached softcap");
        uint256 tempBalance = SafeMath.sub(balances[msg.sender], amount);
        uint256 excessAmount = tempBalance % price;
        uint256 totalDifference = SafeMath.add(amount, excessAmount);
        balances[msg.sender] = SafeMath.sub(balances[msg.sender],totalDifference);
        uint256 tokenBalanceBefore = tokenBalances[msg.sender];
        tokenBalances[msg.sender] = SafeMath.div(balances[msg.sender], price);
        if(tokenBalanceBefore > tokenBalances[msg.sender]){
            uint256 tokenBalanceDifference = SafeMath.sub(tokenBalanceBefore, tokenBalances[msg.sender]);
            totalTokensSold = SafeMath.sub(totalTokensSold, tokenBalanceDifference);
        }
        uint256 totalWithdrawAmount = amount;
        if(excessAmount > 0){
            totalWithdrawAmount = SafeMath.add(totalWithdrawAmount, excessAmount);
        }
        msg.sender.transfer(totalWithdrawAmount);
        emit fundsWithdrawn(msg.sender, totalWithdrawAmount, tokenBalances[msg.sender]);
    }
    function withdrawBoughtTokens() public {
        require(balances[msg.sender] > 0 && tokenBalances[msg.sender] > 0, "Insufficient funds.");
        require(hasSaleEnded() && softcap >= totalTokensSold, "Sale didn't end or didn't reach softcap.");
        require(erc20Token.allowance(tokenCreator, address(this)) >= tokenBalances[msg.sender], "Contract doesn't have sufficient amount of tokens.");
        erc20Token.safeTransferFrom(tokenCreator, msg.sender, tokenBalances[msg.sender]);
        emit tokensWithdrawn(msg.sender, tokenBalances[msg.sender]);
        tokenBalances[msg.sender] = 0;
        balances[msg.sender] = 0;
    }
    function buyTokens() payable public{
        require(isSaleActive(), "This sale has already ended or not started.");
        require(msg.value <= tiersMaxAmountValues[caseStaking.userTiers(msg.sender)], "Your tier is too low to buy this amount of tokens.");
        require(msg.value > 0, "Insufficient funds.");
        uint256 excessAmount = msg.value % price;
        uint256 purchaseAmount = SafeMath.sub(msg.value, excessAmount);
        uint256 tokenPurchase = SafeMath.div(purchaseAmount, price);
        uint256 totalTokensNeeded = SafeMath.add(tokenPurchase, totalTokensSold);
        require(erc20Token.allowance(tokenCreator, address(this)) >= totalTokensNeeded, "Contract doesn't have sufficient amount of tokens.");
        if (excessAmount > 0) {
            msg.sender.transfer(excessAmount);
        }
        totalTokensSold = SafeMath.add(totalTokensSold, tokenPurchase);
        balances[msg.sender] = SafeMath.add(balances[msg.sender], purchaseAmount);
        tokenBalances[msg.sender] = SafeMath.add(tokenBalances[msg.sender], tokenPurchase);
        emit tokensSold(msg.sender, tokenPurchase, purchaseAmount);
    }
}