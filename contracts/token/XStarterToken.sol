pragma solidity 0.6.2;

import "@openzeppelin/contracts/proxy/Initializable.sol";
import "./ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
contract XStarterToken is ERC20, Initializable {
    using SafeMath for uint256;
    struct MintPermitPeriod{
        uint256 startTimestamp;
        uint256 endTimestamp;
        uint256 permitRate;
        uint256 mintedAmount;
    }
    uint256 internal constant SECONDS_IN_THREE_YEARS = 94608000;
    uint256 internal constant SECONDS_IN_ONE_YEAR = 31536000;
    uint256 public initialTotalSupply;
    address public daoAddress;
    address public ownerAddress;
    address public stakingAddress;
    bool public isDAOAssigned = false;
    mapping (uint256 => MintPermitPeriod) public mintPeriods;
    uint256 mintPeriodsLength = 0;
    function initialize(address _owner, uint256 _initialTotalSupply, uint256 _ownerMintPermitRate, address _stakingAddress) public initializer {
        _initialize("XStarter", "XST", 8);
        ownerAddress = _owner;
        stakingAddress = _stakingAddress;
        _mint(_owner, _initialTotalSupply);
        initialTotalSupply = _initialTotalSupply;
        mintPeriods[mintPeriodsLength] = MintPermitPeriod(now, now + SECONDS_IN_THREE_YEARS, _ownerMintPermitRate, 0);
        mintPeriodsLength = mintPeriodsLength.add(1);
    }

    function mint(address recipient, uint256 amount) public returns (bool) {
        require(_msgSender() == ownerAddress || _msgSender() ==  stakingAddress, "mint: unauthorized call!");
        if(_msgSender() == stakingAddress){
            _mint(recipient, amount);
            return true;
        }
        if(_msgSender() == ownerAddress){
            uint256 lastAssignedPeriod = mintPeriodsLength.sub(1);
            require(now < mintPeriods[lastAssignedPeriod].endTimestamp, "Next mint permit rate not assigned yet!");
            if(now >= mintPeriods[lastAssignedPeriod].startTimestamp && now < mintPeriods[lastAssignedPeriod].endTimestamp){
                //mint amount if you can
                 mintInPeriod(recipient, amount, lastAssignedPeriod);
            }else if(now < mintPeriods[lastAssignedPeriod].startTimestamp){
                // find period and see if can mint
                if(now >= mintPeriods[lastAssignedPeriod.sub(1)].startTimestamp && now < mintPeriods[lastAssignedPeriod.sub(1)].endTimestamp){
                    mintInPeriod(recipient, amount, lastAssignedPeriod.sub(1));
                }
            }
        }

        return true;
    }
    function mintInPeriod(address recipient, uint256 amount, uint256 period) internal{
        require(mintPeriods[period].mintedAmount.add(amount) <= initialTotalSupply.mul(mintPeriods[period].permitRate).div(100), "Can't mint more than permitted amount!");
        _mint(recipient, amount);
        mintPeriods[period].mintedAmount = mintPeriods[period].mintedAmount.add(amount);
    }
    function grantDAORole(address dao) public {
        require(!isDAOAssigned, "DAO role is already granted!");
        require(_msgSender()==ownerAddress, "Only contract owner can call this function!");
        daoAddress = dao;
        isDAOAssigned = true;
    }
    function assignOwnerMintPermitRate(uint256 _ownerMintPermitRate) public{
        require(_msgSender() == daoAddress, "Only assigned DAO can call this function!");
        uint256 lastAssignedPeriod = mintPeriodsLength.sub(1);
        require(now >= mintPeriods[lastAssignedPeriod].startTimestamp, "You can only assign permit rate on one year ahead!");
        if(now >= mintPeriods[lastAssignedPeriod].endTimestamp){
            // add mint period startTimestamp is now for one year
            mintPeriods[mintPeriodsLength] = MintPermitPeriod(now, now + SECONDS_IN_ONE_YEAR, _ownerMintPermitRate, 0);
            mintPeriodsLength = mintPeriodsLength.add(1);
        }else if(now >= mintPeriods[lastAssignedPeriod].startTimestamp && now < mintPeriods[lastAssignedPeriod].endTimestamp){
            // add mint period one year after this one
            mintPeriods[mintPeriodsLength] = MintPermitPeriod(mintPeriods[lastAssignedPeriod].endTimestamp, mintPeriods[lastAssignedPeriod].endTimestamp + SECONDS_IN_ONE_YEAR, _ownerMintPermitRate, 0);
            mintPeriodsLength = mintPeriodsLength.add(1);
        }
        
    }
    function changeDAOAddress(address _daoAddress) public {
         require(_msgSender() == daoAddress && isDAOAssigned, "Only assigned DAO can call this function!");
         daoAddress = _daoAddress;
    }
    function burn(uint256 amount) public {
        _burn(_msgSender(), amount);
    }
}
