using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Demo.API.Controllers;

public class AccountsController : ControllerBase
{
    private readonly DbContext _dbContext;

    public async Task<IActionResult> Save()
    {
        await _dbContext.SaveChangesAsync();
        return Ok();
    }
}
