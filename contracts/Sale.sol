pragma solidity 0.6.2;
import "./XStarterStaking.sol";
import "./HasAdmin.sol";
import "./ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
contract Sale is HasAdmin{
    using SafeMath for uint256;
    using SafeERC20 for ERC20;
    
    ERC20 erc20Token;
    XStarterStaking xStarterStaking;
    mapping(address => uint256) public balances;
     
    string public tokenName;
    address public tokenCreator;
    address public tokenAddress;
    uint256 public softcap;
    uint256[] public tiersMaxAmountValues;
    uint256 public startTimestamp;
    uint256 public endTimestamp;
    uint256 public price;
    string public description;
    mapping(address => uint256) public tokenBalances;
    uint256 public numberOfParticipants;
    uint256 public totalTokensSold;
    uint256 public hardcap;
    event tokensSold(
        address buyer,
        uint256 amount,
        uint256 pricePaid
        );
    event fundsWithdrawn(
        address sender,
        uint256 amount
        );
    event tokensWithdrawn(
        address sender,
        uint256 amount
        );
    event hardcapIncreased(
        uint256 amount,
        uint256 newHardcap
        );
    modifier onlySaler {
        require(msg.sender == tokenCreator, "This function can be used only by sale owner!");
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
        address _xStarterStaking
    )
        HasAdmin(_admin)
        public
    {
        require(_startTimestamp < _endTimestamp && now < _endTimestamp, "Invalid timestamp values.");
        xStarterStaking = XStarterStaking(_xStarterStaking);
        require(_tiersMaxAmountValues.length == xStarterStaking.amountOfTiers(), "Invalid amount of tiers");
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
    }
    function changePrice(uint256 newPrice) public onlyAdmin{
        require(now < startTimestamp, "Sale has already started.");
        require(newPrice > 0);
        price = newPrice;
    }
    function getCustomerTier(address customer) internal view returns (uint256){
        return xStarterStaking.userTiers(customer);
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
    function withdrawFunds() public {
        require(balances[msg.sender] >= 0, "You didn't participate in sale.");
        require(now > endTimestamp, "You can't withdraw when sale is in progress");
        require(totalTokensSold < softcap, "You can't withdraw because sale reached softcap");
        msg.sender.transfer(balances[msg.sender]);
        emit fundsWithdrawn(msg.sender, balances[msg.sender]);
        balances[msg.sender] = 0;
    }
    function withdrawBoughtTokens() public {
        require(balances[msg.sender] > 0 && tokenBalances[msg.sender] > 0, "Insufficient funds.");
        require(hasSaleEnded() && softcap <= totalTokensSold, "Sale didn't end or didn't reach softcap.");
        require(hardcap >= tokenBalances[msg.sender], "Contract doesn't have sufficient amount of tokens.");
        erc20Token.safeTransfer(msg.sender, tokenBalances[msg.sender]);
        emit tokensWithdrawn(msg.sender, tokenBalances[msg.sender]);
        tokenBalances[msg.sender] = 0;
        balances[msg.sender] = 0;
    }
    function buyTokens() payable public{
        require(isSaleActive(), "This sale has already ended or not started.");
        require(msg.value > 0, "Insufficient funds.");
        require(softcap <= hardcap, "Softcap is greater than hardcap. This sale is invalid.");
        uint256 excessAmount = msg.value % price;
        uint256 purchaseAmount = SafeMath.sub(msg.value, excessAmount);
        uint256 tokenPurchase = SafeMath.div(purchaseAmount, price);
        uint256 decimals = 10 ** uint256(erc20Token.decimals());
        tokenPurchase = SafeMath.mul(tokenPurchase, decimals);
        require(tokenPurchase <= tiersMaxAmountValues[xStarterStaking.userTiers(msg.sender)], "Your tier is too low to buy this amount of tokens.");
        uint256 totalTokensNeeded = SafeMath.add(tokenPurchase, totalTokensSold);
        require(hardcap >= totalTokensNeeded, "Contract doesn't have sufficient amount of tokens.");
        if (excessAmount > 0) {
            msg.sender.transfer(excessAmount);
        }
        totalTokensSold = SafeMath.add(totalTokensSold, tokenPurchase);
        if(balances[msg.sender] == 0 && tokenBalances[msg.sender] == 0){
            numberOfParticipants = SafeMath.add(numberOfParticipants, 1);
        }
        balances[msg.sender] = SafeMath.add(balances[msg.sender], purchaseAmount);
        tokenBalances[msg.sender] = SafeMath.add(tokenBalances[msg.sender], tokenPurchase);
        emit tokensSold(msg.sender, tokenPurchase, purchaseAmount);
    }
    function addTokensForSale(uint256 amount) public onlySaler{
        require(now < startTimestamp, "Can't do it after sale started");
        erc20Token.safeTransferFrom(msg.sender, address(this), amount);
        hardcap = SafeMath.add(hardcap, amount);
        emit hardcapIncreased(amount, hardcap);
    }
    function withdrawSaleResult() public onlySaler{
        require(now > endTimestamp, "Can withdraw only after sale ended");
        if(totalTokensSold >= softcap){
            uint256 tokenWithdrawAmount = SafeMath.sub(hardcap, totalTokensSold);
            if(tokenWithdrawAmount > 0){
                erc20Token.safeTransfer(msg.sender, tokenWithdrawAmount);
            }
            msg.sender.transfer(address(this).balance);
        }else{
            erc20Token.safeTransfer(msg.sender, hardcap);
        }
    }
}